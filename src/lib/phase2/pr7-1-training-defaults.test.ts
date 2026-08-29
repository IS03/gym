import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const migration = source(
  "supabase/migrations/20260820110000_exercise_suggested_rir_rest.sql",
);
const training = source("src/lib/phase2/training.ts");
const sessionForm = source(
  "src/app/(app)/train/session/[id]/session-create-exercise-form.tsx",
);
const sessionEditor = source(
  "src/app/(app)/train/session/[id]/session-editor.tsx",
);
const addExerciseSheet = source(
  "src/app/(app)/train/session/[id]/add-exercise-sheet.tsx",
);
const library = source(
  "src/app/(app)/train/exercises/exercise-library.tsx",
);

describe("PR 7.1 — defaults y UX de entrenamiento", () => {
  it("agrega defaults nullable con rangos consistentes", () => {
    expect(migration).toContain("add column if not exists rir_sugerido smallint");
    expect(migration).toContain("rir_sugerido between 0 and 10");
    expect(migration).toContain("descanso_min_sugerido_segundos between 0 and 3600");
    expect(migration).toContain("descanso_min_sugerido_segundos <= descanso_max_sugerido_segundos");
    expect(migration).not.toMatch(/update public\.exercises\s+set/i);
  });

  it("copia defaults una vez al crear una configuración de rutina", () => {
    expect(migration).toContain("tr_routine_exercises_apply_exercise_defaults");
    expect(migration).toContain("e.rir_sugerido");
    expect(migration).toContain("target_rir");
    expect(migration).not.toContain("before update on public.exercises");
  });

  it("crear desde sesión guarda defaults e inicializa snapshots y sets", () => {
    for (const name of [
      "rir_sugerido",
      "descanso_min_sugerido_segundos",
      "descanso_max_sugerido_segundos",
    ]) {
      expect(sessionForm).toContain(`name="${name}"`);
      expect(training).toContain(name);
    }
    expect(training).toContain('sourceType: "manual_new"');
    expect(migration).toContain("rest_min_seconds_snapshot");
    expect(migration).toContain("v_exercise.rir_sugerido");
  });

  it("biblioteca expone los seis valores sugeridos", () => {
    for (const label of [
      "Series sugeridas",
      "Repeticiones sugeridas",
      "Peso sugerido en kg",
      "RIR sugerido",
      "Descanso mínimo sugerido en segundos",
      "Descanso máximo sugerido en segundos",
    ]) expect(library).toContain(label);
  });

  it("el selector de sesión tiene header fijo y contenido vertical desplazable", () => {
    expect(sessionEditor).toContain("AddExerciseSheet");
    expect(addExerciseSheet).toContain("flex-col overflow-hidden");
    expect(addExerciseSheet).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(addExerciseSheet).toContain("82svh");
    expect(addExerciseSheet).toContain("env(safe-area-inset-bottom)");
    expect(addExerciseSheet).toContain("overflow-x-auto");
  });
});
