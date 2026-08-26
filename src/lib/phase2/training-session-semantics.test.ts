import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const editor = source("src/app/(app)/train/session/[id]/session-editor.tsx");
const migration = source(
  "supabase/migrations/20260826204057_training_session_semantics_and_routine_notes.sql",
);
const historicalCorrection = source(
  "supabase/migrations/20260811203000_session_history_corrections.sql",
);

type SessionNote = {
  routineExerciseId: string | null;
  routineNoteSnapshot: string | null;
  notes: string | null;
};

function finishNoteSync(
  routineNotes: ReadonlyMap<string, string | null>,
  sessionNotes: readonly SessionNote[],
  succeeds = true,
) {
  const result = new Map(routineNotes);
  if (!succeeds) return result;
  for (const row of sessionNotes) {
    if (
      row.routineExerciseId !== null &&
      row.routineNoteSnapshot !== null &&
      row.notes !== row.routineNoteSnapshot
    ) {
      result.set(row.routineExerciseId, row.notes);
    }
  }
  return result;
}

describe("PR 13 — semántica de la sesión", () => {
  it("ofrece sólo +Peso y +Repeticiones como decisiones nuevas", () => {
    expect(editor).toContain('label: "+ Peso"');
    expect(editor).toContain('label: "+ Repeticiones"');
    expect(editor).not.toContain('label: "Mantener"');
    expect(editor).not.toContain('label: "Personalizado"');
    expect(editor).toContain('payload.decision === "custom"');
    expect(editor).toContain("Recordatorio anterior");
    expect(editor).toContain("Quitar");
  });

  it("mantiene acciones futuras separadas de notas y targets", () => {
    expect(editor).toContain('payload.decision !== "maintain" || payload.apply_to_routine');
    expect(editor).toContain("Guardar lo realizado como nuevo objetivo");
    expect(editor).toContain("Nota para próximas sesiones");
    expect(editor).toContain("Nota del ejercicio en esta sesión");
  });

  it("captura la nota inicial en dos snapshots sin backfill histórico", () => {
    expect(migration).toMatch(
      /decision, decision_note, routine_note_snapshot, notes[\s\S]*?'maintain', null, re\.notes, re\.notes/,
    );
    expect(migration).not.toMatch(
      /update public\.workout_session_exercises[\s\S]{0,200}routine_note_snapshot\s*=/i,
    );
    expect(migration).toContain(
      "tr_workout_session_exercises_immutable_routine_note_snapshot",
    );
    expect(migration).toContain(
      "new.routine_note_snapshot is distinct from old.routine_note_snapshot",
    );
  });

  it("sincroniza A → B y A → null sólo en finish exitoso", () => {
    const initial = new Map([["push-press", "A"]]);
    expect(
      finishNoteSync(initial, [
        { routineExerciseId: "push-press", routineNoteSnapshot: "A", notes: "B" },
      ]).get("push-press"),
    ).toBe("B");
    expect(
      finishNoteSync(initial, [
        { routineExerciseId: "push-press", routineNoteSnapshot: "A", notes: null },
      ]).get("push-press"),
    ).toBeNull();
    expect(
      finishNoteSync(
        initial,
        [{ routineExerciseId: "push-press", routineNoteSnapshot: "A", notes: "B" }],
        false,
      ).get("push-press"),
    ).toBe("A");
  });

  it("no reescribe A → A ni otra rutina del mismo ejercicio", () => {
    const initial = new Map<string, string | null>([
      ["push-press", "A"],
      ["pull-press", "Otra rutina"],
    ]);
    const unchanged = finishNoteSync(initial, [
      { routineExerciseId: "push-press", routineNoteSnapshot: "A", notes: "A" },
    ]);
    expect(unchanged.get("push-press")).toBe("A");
    expect(unchanged.get("pull-press")).toBe("Otra rutina");
  });

  it("acota el SQL por routine_exercise_id, snapshot y cambio explícito", () => {
    expect(migration).toContain("set notes = se.notes");
    expect(migration).toContain("se.routine_exercise_id = re.id");
    expect(migration).toContain("se.routine_note_snapshot is not null");
    expect(migration).toContain("se.notes is distinct from se.routine_note_snapshot");
  });

  it("preserva targets sólo para apply_to_routine y sets completadas", () => {
    expect(migration).toContain("and apply_to_routine");
    expect(migration).toContain("and routine_exercise_id is not null");
    expect(migration).toContain("ws.is_completed");
  });

  it("no propaga notas desde correcciones históricas", () => {
    expect(historicalCorrection).toContain("status = 'completed'");
    expect(historicalCorrection).not.toContain("update public.routine_exercises");
    expect(historicalCorrection).not.toContain("routine_note_snapshot");
  });

  it("conserva seguridad y permisos de los RPC vigentes", () => {
    expect(migration.match(/security invoker/g)).toHaveLength(3);
    expect(migration.match(/set search_path = ''/g)).toHaveLength(3);
    expect(migration).toContain(
      "revoke all on function public.start_workout_session(uuid, uuid) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.finish_workout_session(uuid, jsonb) to authenticated",
    );
  });
});
