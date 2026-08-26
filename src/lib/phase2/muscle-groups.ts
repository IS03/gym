import type { MuscleGroup } from "./types";

export const MUSCLE_GROUP_OPTIONS: ReadonlyArray<{
  value: MuscleGroup;
  label: string;
}> = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "bíceps", label: "Bíceps" },
  { value: "tríceps", label: "Tríceps" },
  { value: "abdomen", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
];

export type MuscleGroupFilter = "all" | MuscleGroup;

export function muscleGroupLabel(group: MuscleGroup | null | undefined): string | null {
  return MUSCLE_GROUP_OPTIONS.find((option) => option.value === group)?.label ?? null;
}

export function filterExercisesByMuscleGroup<T extends { grupo_muscular: MuscleGroup | null }>(
  exercises: readonly T[],
  filter: MuscleGroupFilter,
): T[] {
  return filter === "all"
    ? [...exercises]
    : exercises.filter((exercise) => exercise.grupo_muscular === filter);
}
