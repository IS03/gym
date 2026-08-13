import { MUSCLE_GROUP_OPTIONS } from "./muscle-groups";
import type { Exercise, MuscleGroup } from "./types";

export type ExerciseLibraryFilter = "all" | "none" | MuscleGroup;

export type ExerciseLibraryItem = Pick<
  Exercise,
  | "id"
  | "nombre"
  | "grupo_muscular"
  | "muscle_group_label"
  | "series_sugeridas"
  | "reps_sugeridas"
  | "peso_sugerido"
  | "updated_at"
>;

const GROUP_LABELS = new Map(
  MUSCLE_GROUP_OPTIONS.map((option) => [option.value, option.label]),
);

export function isMuscleGroup(value: string): value is MuscleGroup {
  return MUSCLE_GROUP_OPTIONS.some((option) => option.value === value);
}

export function exerciseGroupLabel(exercise: ExerciseLibraryItem): string {
  return (
    exercise.muscle_group_label ??
    (exercise.grupo_muscular ? GROUP_LABELS.get(exercise.grupo_muscular) : null) ??
    "Sin grupo"
  );
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

  return values.length > 0 ? values.join(" · ") : null;
}

export function exerciseLibrarySummary(exercise: ExerciseLibraryItem): string {
  const values = exerciseSuggestedValuesLabel(exercise);
  return values
    ? `${exerciseGroupLabel(exercise)} · ${values}`
    : exerciseGroupLabel(exercise);
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
