import { MUSCLE_GROUP_OPTIONS, muscleGroupLabel } from "./muscle-groups";
import type { RoutineColorKey } from "./routine-colors";
import type { Exercise, MuscleGroup } from "./types";

export type ExerciseLibraryStatus = "active" | "archived" | "all";
export type ExerciseLibraryGroup = MuscleGroup | "none";

export type ExerciseLibraryRoutine = { id: string; nombre: string; color: RoutineColorKey | null };
export type ExerciseLibraryMembership = ExerciseLibraryRoutine;
export type ExerciseLibraryFilters = {
  routineIds: string[];
  withRoutine: boolean;
  withoutRoutine: boolean;
  muscleGroups: ExerciseLibraryGroup[];
  implements: string[];
  status: ExerciseLibraryStatus;
};
export const DEFAULT_EXERCISE_LIBRARY_FILTERS: ExerciseLibraryFilters = {
  routineIds: [], withRoutine: false, withoutRoutine: false, muscleGroups: [], implements: [], status: "active",
};
export type ExerciseLibrarySection = { value: ExerciseLibraryGroup; label: string; exercises: ExerciseLibraryItem[] };
export type ExerciseLibraryItem = Pick<Exercise,
  "id" | "nombre" | "grupo_muscular" | "muscle_group_label" | "implement" | "weight_mode"
  | "series_sugeridas" | "reps_sugeridas" | "peso_sugerido" | "rir_sugerido"
  | "descanso_min_sugerido_segundos" | "descanso_max_sugerido_segundos"
  | "notes" | "is_active" | "updated_at"
> & { memberships: ExerciseLibraryMembership[] };

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

export function normalizeExerciseSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/\s+/g, " ").trim();
}

export function exerciseGroupLabel(exercise: ExerciseIdentityFields): string {
  return nonEmptyText(exercise.muscle_group_label) ?? muscleGroupLabel(exercise.grupo_muscular) ?? "Sin grupo";
}

export function exerciseIdentityLabel(exercise: ExerciseIdentityFields): string {
  return [exerciseGroupLabel(exercise), nonEmptyText(exercise.implement), nonEmptyText(exercise.weight_mode)]
    .filter((part): part is string => Boolean(part)).join(" · ");
}

export function exerciseLibrarySummary(exercise: ExerciseLibraryItem): string {
  return [nonEmptyText(exercise.implement), nonEmptyText(exercise.weight_mode)]
    .filter((part): part is string => Boolean(part)).join(" · ") || "Sin configuración";
}

function exerciseSearchText(exercise: ExerciseLibraryItem): string {
  return normalizeExerciseSearch([exercise.nombre, muscleGroupLabel(exercise.grupo_muscular), exercise.muscle_group_label,
    exercise.implement, exercise.weight_mode].filter((value): value is string => Boolean(value)).join(" "));
}

export function sortExerciseLibrary(exercises: readonly ExerciseLibraryItem[]): ExerciseLibraryItem[] {
  return [...exercises].sort((left, right) => left.nombre.localeCompare(right.nombre, "es-AR"));
}

export function groupExerciseLibrary(exercises: readonly ExerciseLibraryItem[]): ExerciseLibrarySection[] {
  const byGroup = new Map<ExerciseLibraryGroup, ExerciseLibraryItem[]>();
  for (const exercise of exercises) {
    const key = exercise.grupo_muscular ?? "none";
    byGroup.set(key, [...(byGroup.get(key) ?? []), exercise]);
  }
  const orderedGroups: ReadonlyArray<{ value: ExerciseLibraryGroup; label: string }> = [
    ...MUSCLE_GROUP_OPTIONS, { value: "none", label: "Sin grupo" },
  ];
  return orderedGroups.flatMap((group) => {
    const entries = byGroup.get(group.value);
    return entries?.length ? [{ ...group, exercises: sortExerciseLibrary(entries) }] : [];
  });
}

export function filterExerciseLibrary(exercises: readonly ExerciseLibraryItem[], input: { query: string; filters: ExerciseLibraryFilters }): ExerciseLibraryItem[] {
  const query = normalizeExerciseSearch(input.query);
  const selectedImplements = new Set(input.filters.implements.map(normalizeExerciseSearch));
  return exercises.filter((exercise) => {
    const statusMatches = input.filters.status === "all" || (input.filters.status === "active" ? exercise.is_active : !exercise.is_active);
    const routineMatches = input.filters.withoutRoutine ? exercise.memberships.length === 0
      : input.filters.withRoutine
        ? exercise.memberships.length > 0 && (input.filters.routineIds.length === 0 || exercise.memberships.some((membership) => input.filters.routineIds.includes(membership.id)))
        : input.filters.routineIds.length === 0 || exercise.memberships.some((membership) => input.filters.routineIds.includes(membership.id));
    const muscleMatches = input.filters.muscleGroups.length === 0 || input.filters.muscleGroups.includes(exercise.grupo_muscular ?? "none");
    const implementMatches = selectedImplements.size === 0 || selectedImplements.has(normalizeExerciseSearch(exercise.implement ?? ""));
    return statusMatches && routineMatches && muscleMatches && implementMatches && exerciseSearchText(exercise).includes(query);
  });
}

export function exerciseLibraryActiveFilterCount(filters: ExerciseLibraryFilters): number {
  return filters.routineIds.length + Number(filters.withRoutine && filters.routineIds.length === 0) + Number(filters.withoutRoutine) + filters.muscleGroups.length
    + filters.implements.length + Number(filters.status !== "active");
}

export function exerciseLibraryImplementOptions(exercises: readonly ExerciseLibraryItem[]): string[] {
  const values = new Map<string, string>();
  for (const exercise of exercises) {
    const label = nonEmptyText(exercise.implement);
    if (label) values.set(normalizeExerciseSearch(label), label);
  }
  return [...values.values()].sort((left, right) => left.localeCompare(right, "es-AR"));
}

export function diffRoutineMemberships(currentIds: readonly string[], nextIds: readonly string[]) {
  const current = new Set(currentIds);
  const next = new Set(nextIds);
  return { add: nextIds.filter((id) => !current.has(id)), remove: currentIds.filter((id) => !next.has(id)) };
}
