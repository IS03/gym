import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/train/exercises/page.tsx", "utf8");
const actions = readFileSync("src/app/(app)/train/actions.ts", "utf8");
const training = readFileSync("src/lib/phase2/training.ts", "utf8");
const defaultsMigration = readFileSync("supabase/migrations/20260820110000_exercise_suggested_rir_rest.sql", "utf8");

describe("exercise library data contracts", () => {
  it("carga ejercicios activos y archivados en batch, con rutinas sólo activas", () => {
    expect(page).toContain("listExercises({ includeArchived: true })");
    expect(page).toContain("listRoutines({ includeArchived: false })");
    expect(page).toContain("listExerciseRoutineMemberships(routines.map");
  });

  it("sincroniza memberships activas de forma idempotente", () => {
    expect(training).toContain("syncExerciseActiveRoutineMemberships");
    expect(training).toContain("new Set(input.routineIds.filter(Boolean))");
    expect(training).toContain("!currentByRoutine.has(routineId)");
    expect(actions).toContain("syncExerciseActiveRoutineMemberships({ exerciseId: id, routineIds })");
  });

  it("copia defaults al crear una referencia mediante el contrato canónico de base", () => {
    expect(defaultsMigration).toContain("routine_exercises_apply_exercise_defaults");
    expect(defaultsMigration).toContain("routine_exercises_create_default_sets");
    expect(defaultsMigration).toContain("e.series_sugeridas");
    expect(defaultsMigration).toContain("e.rir_sugerido");
  });

  it("informa un fallo parcial sin inducir un reintento que duplique el ejercicio", () => {
    expect(actions).toContain("Ejercicio creado. No pudo agregarse a la rutina");
    expect(actions).toContain("warning }");
  });
});
