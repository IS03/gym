import { muscleGroupLabel } from "./muscle-groups";
import type { Exercise, MuscleGroup } from "./types";

export type ExerciseLibraryFilter = "all" | "none" | MuscleGroup;

export type ExerciseLibraryItem = Pick<
  Exercise,
  | "id"
  | "nombre"
  | "grupo_muscular"
  | "muscle_group_label"
  | "implement"
  | "weight_mode"
  | "series_sugeridas"
  | "reps_sugeridas"
  | "peso_sugerido"
  | "rir_sugerido"
  | "descanso_min_sugerido_segundos"
  | "descanso_max_sugerido_segundos"
  | "updated_at"
>;

export function isMuscleGroup(value: string): value is MuscleGroup {
  return muscleGroupLabel(value as MuscleGroup) !== null;
}

type ExerciseIdentityFields = {
  grupo_muscular: MuscleGroup | null;
  muscle_group_label?: string | null;
  implement?: string | null;
  weight_mode?: string | null;
};

function nonEmptyText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function exerciseGroupLabel(exercise: ExerciseIdentityFields): string {
  return (
    nonEmptyText(exercise.muscle_group_label) ??
    muscleGroupLabel(exercise.grupo_muscular) ??
    "Sin grupo"
  );
}

export function exerciseIdentityLabel(exercise: ExerciseIdentityFields): string {
  return [
    exerciseGroupLabel(exercise),
    nonEmptyText(exercise.implement),
    nonEmptyText(exercise.weight_mode),
  ].filter((part): part is string => Boolean(part)).join(" · ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
  }).format(value);
}

export function exerciseSuggestedValuesLabel(exercise: ExerciseLibraryItem): string | null {
  const values: string[] = [];
  const series = exercise.series_sugeridas;
  const reps = exercise.reps_sugeridas;

  if (series !== null && series > 0 && reps !== null && reps > 0) {
    values.push(`${formatNumber(series)}×${formatNumber(reps)}`);
  } else if (series !== null && series > 0) {
    values.push(`${formatNumber(series)} ${series === 1 ? "serie" : "series"}`);
  } else if (reps !== null && reps > 0) {
    values.push(`${formatNumber(reps)} reps`);
  }

  if (exercise.peso_sugerido !== null && exercise.peso_sugerido > 0) {
    values.push(`${formatNumber(exercise.peso_sugerido)} kg`);
  }

  if (exercise.rir_sugerido !== null) {
    values.push(`RIR ${formatNumber(exercise.rir_sugerido)}`);
  }

  if (
    exercise.descanso_min_sugerido_segundos !== null &&
    exercise.descanso_max_sugerido_segundos !== null
  ) {
    const minimum = exercise.descanso_min_sugerido_segundos;
    const maximum = exercise.descanso_max_sugerido_segundos;
    values.push(minimum === maximum ? `${minimum} s` : `${minimum}–${maximum} s`);
  }

  return values.length > 0 ? values.join(" · ") : null;
}

export function exerciseLibrarySummary(exercise: ExerciseLibraryItem): string {
  return exerciseIdentityLabel(exercise);
}

export function filterExerciseLibrary(
  exercises: readonly ExerciseLibraryItem[],
  input: { query: string; group: ExerciseLibraryFilter },
): ExerciseLibraryItem[] {
  const query = input.query.trim().toLocaleLowerCase("es-AR");
  return exercises.filter((exercise) => {
    const groupMatches =
      input.group === "all" ||
      (input.group === "none"
        ? exercise.grupo_muscular === null
        : exercise.grupo_muscular === input.group);
    return (
      groupMatches &&
      exercise.nombre.toLocaleLowerCase("es-AR").includes(query)
    );
  });
}
