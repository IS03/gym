import { parseLocalizedDecimal } from "../localized-decimal";
import type { ExerciseMutationInput } from "./exercise-mutation";
import type { ExerciseLibraryItem } from "./exercise-library";
import type { MuscleGroup } from "./types";

export type ExerciseFormValues = {
  nombre: string;
  grupo_muscular: MuscleGroup | "";
  muscle_group_label: string;
  implement: string;
  weight_mode: string;
  series_sugeridas: string;
  reps_sugeridas: string;
  peso_sugerido: string;
  rir_sugerido: string;
  descanso_min_sugerido_segundos: string;
  descanso_max_sugerido_segundos: string;
};

export function emptyForm(): ExerciseFormValues {
  return {
    nombre: "",
    grupo_muscular: "",
    muscle_group_label: "",
    implement: "",
    weight_mode: "",
    series_sugeridas: "",
    reps_sugeridas: "",
    peso_sugerido: "",
    rir_sugerido: "",
    descanso_min_sugerido_segundos: "",
    descanso_max_sugerido_segundos: "",
  };
}

export function formFromExercise(exercise: ExerciseLibraryItem): ExerciseFormValues {
  return {
    nombre: exercise.nombre,
    grupo_muscular: exercise.grupo_muscular ?? "",
    muscle_group_label: exercise.muscle_group_label ?? "",
    implement: exercise.implement ?? "",
    weight_mode: exercise.weight_mode ?? "",
    series_sugeridas: exercise.series_sugeridas === null ? "" : String(exercise.series_sugeridas),
    reps_sugeridas: exercise.reps_sugeridas === null ? "" : String(exercise.reps_sugeridas),
    peso_sugerido: exercise.peso_sugerido === null ? "" : String(exercise.peso_sugerido),
    rir_sugerido: exercise.rir_sugerido === null ? "" : String(exercise.rir_sugerido),
    descanso_min_sugerido_segundos:
      exercise.descanso_min_sugerido_segundos === null ? "" : String(exercise.descanso_min_sugerido_segundos),
    descanso_max_sugerido_segundos:
      exercise.descanso_max_sugerido_segundos === null ? "" : String(exercise.descanso_max_sugerido_segundos),
  };
}

function numberOrNull(raw: string, label: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const number = parseLocalizedDecimal(value);
  if (number === null || number < 0) {
    throw new Error(`${label} debe ser un número igual o mayor a cero.`);
  }
  return number;
}

export function mutationFromForm(values: ExerciseFormValues): ExerciseMutationInput {
  return {
    nombre: values.nombre,
    grupo_muscular: values.grupo_muscular || null,
    muscle_group_label: values.muscle_group_label,
    implement: values.implement,
    weight_mode: values.weight_mode,
    series_sugeridas: numberOrNull(values.series_sugeridas, "Series sugeridas"),
    reps_sugeridas: numberOrNull(values.reps_sugeridas, "Repeticiones sugeridas"),
    peso_sugerido: numberOrNull(values.peso_sugerido, "Peso sugerido"),
    rir_sugerido: numberOrNull(values.rir_sugerido, "RIR sugerido"),
    descanso_min_sugerido_segundos: numberOrNull(
      values.descanso_min_sugerido_segundos,
      "Descanso mínimo sugerido",
    ),
    descanso_max_sugerido_segundos: numberOrNull(
      values.descanso_max_sugerido_segundos,
      "Descanso máximo sugerido",
    ),
  };
}
