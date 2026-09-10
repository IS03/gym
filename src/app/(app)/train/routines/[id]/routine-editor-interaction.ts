import type { MuscleGroup, TrainingAdjustment } from "@/lib/phase2/types";
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

/** The section action belongs to the populated list; empty routines own their CTA. */
export function shouldShowRoutineExerciseSectionAddAction(itemCount: number) {
  return itemCount > 0;
}

export type SelectableRoutineAdjustment = Extract<
  TrainingAdjustment,
  "increase_weight" | "increase_reps"
>;

/** Two toggles keep `maintain` neutral and legacy `custom` intact until replaced. */
export function toggleRoutineNextAdjustment(
  current: TrainingAdjustment,
  clicked: SelectableRoutineAdjustment,
): TrainingAdjustment {
  return current === clicked ? "maintain" : clicked;
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
