import type { MuscleGroup } from "@/lib/phase2/types";
import type { MuscleGroupFilter } from "@/lib/phase2/muscle-groups";

type RoutinePickerExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
};

/** Keeps the editor focused on one exercise without discarding its local payload. */
export function nextExpandedRoutineExerciseId(
  currentExerciseId: string | null,
  requestedExerciseId: string,
) {
  return currentExerciseId === requestedExerciseId ? null : requestedExerciseId;
}

export function canMutateRoutineStructure(dirtyExerciseCount: number) {
  return dirtyExerciseCount === 0;
}

/** Filters only the picker result area; the selected id stays owned by the caller. */
export function filterRoutinePickerExercises<T extends RoutinePickerExercise>(
  exercises: readonly T[],
  existingExerciseIds: ReadonlySet<string>,
  muscleGroup: MuscleGroupFilter,
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");

  return exercises.filter((exercise) => (
    !existingExerciseIds.has(exercise.id)
    && (muscleGroup === "all" || exercise.grupo_muscular === muscleGroup)
    && exercise.nombre.toLocaleLowerCase("es-AR").includes(normalizedQuery)
  ));
}
