import { ExerciseReportView } from "@/components/training/exercise-report-view";
import { listExercises } from "@/lib/phase2/training";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import {
  listRobustExerciseHistory,
  listRobustExerciseHistoryRoutineOptions,
  todayInCordoba,
} from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["30d", "90d", "4w", "8w", "3m", "6m", "1y", "all"]);

function isoDaysBefore(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function periodStart(period: string) {
  const today = todayInCordoba();
  if (period === "30d") return isoDaysBefore(today, 30);
  if (period === "4w") return isoDaysBefore(today, 27);
  if (period === "8w") return isoDaysBefore(today, 55);
  if (period === "3m") return isoDaysBefore(today, 89);
  if (period === "6m") {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() - 6);
    return value.toISOString().slice(0, 10);
  }
  if (period === "1y") {
    const value = new Date(`${today}T12:00:00Z`);
    value.setUTCFullYear(value.getUTCFullYear() - 1);
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
  const rawPeriod = typeof sp.period === "string" && PERIODS.has(sp.period) ? sp.period : "3m";
  const period = rawPeriod === "30d" ? "4w" : rawPeriod === "90d" ? "3m" : rawPeriod;
  const routineId = typeof sp.routine_id === "string" && sp.routine_id ? sp.routine_id : null;
  const [allExercises, items, routineOptions] = await Promise.all([
    listExercises({ includeArchived: true }),
    listRobustExerciseHistory({ exerciseId, fromDate: periodStart(period), routineId: routineId ?? undefined, limit: 20 }),
    listRobustExerciseHistoryRoutineOptions(exerciseId),
  ]);
  const exercise = allExercises.find((item) => item.id === exerciseId) ?? null;
  const cameFromProgress = sp.from === "progress";
  const progressView = typeof sp.view === "string" && ["general", "routines", "muscles", "exercises"].includes(sp.view) ? sp.view : "general";
  const progressRoutine = typeof sp.routine === "string" ? sp.routine : null;
  const progressMuscle = typeof sp.muscle === "string" ? sp.muscle : null;
  const progressQuery = typeof sp.query === "string" ? sp.query : null;
  const progressRoutineFilter = typeof sp.routine_filter === "string" ? sp.routine_filter : null;
  const progressMuscleFilter = typeof sp.muscle_filter === "string" ? sp.muscle_filter : null;
  const progressParams = new URLSearchParams({ view: progressView, period });
  if (progressRoutine) progressParams.set("routine", progressRoutine);
  if (progressMuscle) progressParams.set("muscle", progressMuscle);
  if (progressQuery) progressParams.set("query", progressQuery);
  if (progressRoutineFilter) progressParams.set("routine_filter", progressRoutineFilter);
  if (progressMuscleFilter) progressParams.set("muscle_filter", progressMuscleFilter);
  const progressBackLabel = progressView === "routines"
    ? routineOptions.find((routine) => routine.id === progressRoutine)?.nombre ?? "Rutinas"
    : progressView === "muscles"
      ? MUSCLE_GROUP_OPTIONS.find((option) => option.value === progressMuscle)?.label ?? "Músculos"
      : progressView === "exercises"
        ? "Ejercicios"
        : "Entrenamiento";
  const latestSnapshot = items[0]?.exercise ?? null;

  return <ExerciseReportView
    exerciseName={exercise?.nombre ?? latestSnapshot?.nombre_snapshot ?? "Ejercicio"}
    muscleLabel={exercise?.muscle_group_label ?? exercise?.grupo_muscular ?? latestSnapshot?.muscle_group_label_snapshot ?? latestSnapshot?.grupo_muscular_snapshot ?? null}
    period={period}
    routineId={routineId}
    routines={routineOptions}
    backHref={cameFromProgress ? `/train/progress?${progressParams.toString()}` : "/train/history?view=exercises"}
    backLabel={cameFromProgress ? progressBackLabel : "Historial"}
    source={cameFromProgress ? "progress" : "history"}
    progressContext={cameFromProgress ? { view: progressView, routineId: progressRoutine, muscleKey: progressMuscle, query: progressQuery, routineFilter: progressRoutineFilter, muscleFilter: progressMuscleFilter } : undefined}
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
