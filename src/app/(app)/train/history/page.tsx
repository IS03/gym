import { listExerciseRoutineMemberships, listExercises, listRoutines } from "@/lib/phase2/training";
import { getTrainingProgress } from "@/lib/phase2/training-robust";
import { HistoryExerciseList } from "./history-exercise-list";

export const dynamic = "force-dynamic";

export default async function TrainHistoryPage() {
  const [exercises, progress, routines] = await Promise.all([
    listExercises({ includeArchived: false }),
    getTrainingProgress(),
    listRoutines({ includeArchived: false }),
  ]);
  const memberships = await listExerciseRoutineMemberships(routines.map((routine) => routine.id));
  const progressByExerciseId = new Map(
    progress.exercises.map((exercise) => [exercise.exerciseId, exercise]),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial de ejercicios</h1>
        <p className="text-sm text-muted-foreground">
          Buscá un ejercicio y compará tus registros reales.
        </p>
      </div>
      <HistoryExerciseList
        exercises={exercises.map((exercise) => ({
          ...exercise,
          progress: progressByExerciseId.get(exercise.id) ?? null,
          routineIds: (memberships.get(exercise.id) ?? []).map((membership) => membership.id),
        }))}
        routines={routines.map((routine) => ({ id: routine.id, nombre: routine.nombre }))}
      />
    </div>
  );
}
