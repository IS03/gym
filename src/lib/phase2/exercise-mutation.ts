import { isMuscleGroup } from "./exercise-library";
import type { MuscleGroup } from "./types";

export type ExerciseMutationInput = {
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  implement: string | null;
  weight_mode: string | null;
  series_sugeridas: number | null;
  reps_sugeridas: number | null;
  peso_sugerido: number | null;
  rir_sugerido: number | null;
  descanso_min_sugerido_segundos: number | null;
  descanso_max_sugerido_segundos: number | null;
};

export type ExerciseActionExercise = ExerciseMutationInput & {
  id: string;
  updated_at: string;
};

export type ExerciseActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const EXERCISE_IMPLEMENT_SUGGESTIONS = [
  "Máquina",
  "Mancuernas",
  "Polea",
  "Polea con barra",
  "Barra",
  "Peso corporal",
] as const;

export const EXERCISE_WEIGHT_MODE_SUGGESTIONS = [
  "Peso total",
  "Por mancuerna",
  "Por brazo",
  "Total con barra",
  "Peso corporal",
  "Lingotes (no kg)",
  "Tiempo (segundos)",
] as const;

function numberFromExerciseInput(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número igual o mayor a cero.`);
  }
  return value;
}

function integerInRangeFromExerciseInput(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | null {
  const number = numberFromExerciseInput(value, label);
  if (number !== null && (!Number.isInteger(number) || number < min || number > max)) {
    throw new Error(`${label} debe ser un entero entre ${min} y ${max}.`);
  }
  return number;
}

function optionalTextFromExerciseInput(
  value: unknown,
  label: string,
  maxLength = 120,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${label} debe ser texto.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`${label} no puede superar ${maxLength} caracteres.`);
  }
  return normalized;
}

export function normalizeExerciseMutation(input: unknown): ExerciseMutationInput {
  const values = input as Partial<ExerciseMutationInput> | null | undefined;
  const nombre = typeof values?.nombre === "string" ? values.nombre.trim() : "";
  if (!nombre) throw new Error("Nombre es obligatorio.");

  const grupo_muscular = values?.grupo_muscular ?? null;
  if (grupo_muscular !== null && !isMuscleGroup(grupo_muscular)) {
    throw new Error("Grupo muscular inválido.");
  }

  const rir_sugerido = integerInRangeFromExerciseInput(
    values?.rir_sugerido,
    "RIR sugerido",
    0,
    10,
  );
  const descanso_min_sugerido_segundos = integerInRangeFromExerciseInput(
    values?.descanso_min_sugerido_segundos,
    "Descanso mínimo sugerido",
    0,
    3600,
  );
  const descanso_max_sugerido_segundos = integerInRangeFromExerciseInput(
    values?.descanso_max_sugerido_segundos,
    "Descanso máximo sugerido",
    0,
    3600,
  );
  if (
    (descanso_min_sugerido_segundos === null) !==
    (descanso_max_sugerido_segundos === null)
  ) {
    throw new Error("Completá ambos descansos sugeridos o dejalos vacíos.");
  }
  if (
    descanso_min_sugerido_segundos !== null &&
    descanso_max_sugerido_segundos !== null &&
    descanso_min_sugerido_segundos > descanso_max_sugerido_segundos
  ) {
    throw new Error("El descanso mínimo sugerido no puede superar al máximo.");
  }

  return {
    nombre,
    grupo_muscular,
    muscle_group_label: optionalTextFromExerciseInput(
      values?.muscle_group_label,
      "Detalle muscular",
    ),
    implement: optionalTextFromExerciseInput(values?.implement, "Implemento"),
    weight_mode: optionalTextFromExerciseInput(values?.weight_mode, "Registro de carga"),
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
    rir_sugerido,
    descanso_min_sugerido_segundos,
    descanso_max_sugerido_segundos,
  };
}
