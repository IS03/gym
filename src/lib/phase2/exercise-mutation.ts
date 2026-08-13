import { isMuscleGroup } from "./exercise-library";
import type { MuscleGroup } from "./types";

export type ExerciseMutationInput = {
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  series_sugeridas: number | null;
  reps_sugeridas: number | null;
  peso_sugerido: number | null;
};

export type ExerciseActionExercise = ExerciseMutationInput & {
  id: string;
  muscle_group_label: string | null;
  updated_at: string;
};

export type ExerciseActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function numberFromExerciseInput(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número igual o mayor a cero.`);
  }
  return value;
}

export function normalizeExerciseMutation(input: unknown): ExerciseMutationInput {
  const values = input as Partial<ExerciseMutationInput> | null | undefined;
  const nombre = typeof values?.nombre === "string" ? values.nombre.trim() : "";
  if (!nombre) throw new Error("Nombre es obligatorio.");

  const grupo_muscular = values?.grupo_muscular ?? null;
  if (grupo_muscular !== null && !isMuscleGroup(grupo_muscular)) {
    throw new Error("Grupo muscular inválido.");
  }

  return {
    nombre,
    grupo_muscular,
    series_sugeridas: numberFromExerciseInput(
      values?.series_sugeridas,
      "Series sugeridas",
    ),
    reps_sugeridas: numberFromExerciseInput(
      values?.reps_sugeridas,
      "Repeticiones sugeridas",
    ),
    peso_sugerido: numberFromExerciseInput(
      values?.peso_sugerido,
      "Peso sugerido",
    ),
  };
}
