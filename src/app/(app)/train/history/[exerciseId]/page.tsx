import { ExerciseReportView } from "@/components/training/exercise-report-view";
import { listExercises } from "@/lib/phase2/training";
import {
  listRobustExerciseHistory,
  listRobustExerciseHistoryRoutineOptions,
  todayInCordoba,
} from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["30d", "90d", "6m", "all"]);

function isoDaysBefore(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function periodStart(period: string) {
  const today = todayInCordoba();
  if (period === "30d") return isoDaysBefore(today, 30);
  if (period === "6m") {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() - 6);
    return value.toISOString().slice(0, 10);
  }
  return period === "all" ? undefined : isoDaysBefore(today, 90);
}

export default async function ExerciseHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { exerciseId } = await params;
  const sp = (await searchParams) ?? {};
  const rawPeriod = typeof sp.period === "string" && PERIODS.has(sp.period) ? sp.period : "90d";
  const routineId = typeof sp.routine_id === "string" && sp.routine_id ? sp.routine_id : null;
  const [allExercises, items, routineOptions] = await Promise.all([
    listExercises({ includeArchived: true }),
    listRobustExerciseHistory({ exerciseId, fromDate: periodStart(rawPeriod), routineId: routineId ?? undefined, limit: 20 }),
    listRobustExerciseHistoryRoutineOptions(exerciseId),
  ]);
  const exercise = allExercises.find((item) => item.id === exerciseId) ?? null;
  const cameFromProgress = sp.from === "progress";

  return <ExerciseReportView
    exerciseName={exercise?.nombre ?? "Ejercicio"}
    muscleLabel={exercise?.muscle_group_label ?? exercise?.grupo_muscular ?? null}
    period={rawPeriod}
    routineId={routineId}
    routines={routineOptions}
    backHref={cameFromProgress ? "/train/progress" : "/train/history?view=exercises"}
    backLabel={cameFromProgress ? "Progreso" : "Historial"}
    source={cameFromProgress ? "progress" : "history"}
    sessions={items.map((item) => ({
      sessionId: item.session.id,
      logDate: item.logDate,
      routineId: item.session.routine_id,
      routineName: item.session.routine_name_snapshot ?? item.session.session_name ?? "Sesión libre",
      decision: item.exercise.decision,
      sets: item.exercise.sets.map((set) => ({
        id: set.id,
        set_number: set.set_number,
        target_reps: set.target_reps,
        target_weight_kg: set.target_weight_kg,
        target_rir: set.target_rir,
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        is_completed: set.is_completed,
      })),
    }))}
  />;
}
