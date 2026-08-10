import { listExercises } from "@/lib/phase2/training";
import { getTrainingProgress } from "@/lib/phase2/training-robust";
import { HistoryExerciseList } from "./history-exercise-list";

export const dynamic = "force-dynamic";

export default async function TrainHistoryPage() {
  const [exercises, progress] = await Promise.all([
    listExercises({ includeArchived: false }),
    getTrainingProgress(),
  ]);
  const progressByExerciseId = new Map(
    progress.exercises.map((exercise) => [exercise.exerciseId, exercise]),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Buscá un ejercicio y compará tus registros reales.
        </p>
      </div>
      <HistoryExerciseList
        exercises={exercises.map((exercise) => ({
          ...exercise,
          progress: progressByExerciseId.get(exercise.id) ?? null,
        }))}
      />
    </div>
  );
}
