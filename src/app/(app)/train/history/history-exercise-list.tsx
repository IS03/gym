"use client";

import { ExerciseDirectory } from "@/components/training/exercise-directory";
import type { ExerciseProgressSummary, MuscleGroup } from "@/lib/phase2/types";

type HistoryExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  progress: ExerciseProgressSummary | null;
  routineIds: string[];
};
export function HistoryExerciseList({ exercises, routines }: { exercises: HistoryExercise[]; routines: Array<{ id: string; nombre: string }> }) {
  return <ExerciseDirectory mode="history" routines={routines} items={exercises.map((exercise) => ({
    id: exercise.id, name: exercise.nombre, muscleGroup: exercise.grupo_muscular, muscleLabel: exercise.muscle_group_label,
    lastDate: exercise.progress?.lastDate ?? null, sessions: exercise.progress?.sessions ?? 0,
    bestWeightKg: exercise.progress?.bestWeightKg ?? null, totalVolumeKg: exercise.progress?.totalVolumeKg ?? 0,
    lastDecision: exercise.progress?.lastDecision ?? null, lastSets: exercise.progress?.lastSets ?? [], routineIds: exercise.routineIds,
  }))} />;
}
