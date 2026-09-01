import { ExerciseReportView } from "@/components/training/exercise-report-view";
import { listExercises } from "@/lib/phase2/training";
import {
  isTrainingAnalysisPeriod,
  previousTrainingAnalysisPeriodRange,
  trainingAnalysisPeriodRange,
} from "@/lib/phase2/training-analysis";
import { buildExerciseSessionSelfComparison, buildTrainingComparison } from "@/lib/phase2/training-comparison";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import {
  getTrainingAnalysis,
  listRobustExerciseHistory,
  listRobustExerciseHistoryRoutineOptions,
  todayInCordoba,
  type RobustExerciseHistoryItem,
} from "@/lib/phase2/training-robust";
import type { ExerciseReportSession } from "@/lib/phase2/exercise-insights";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["30d", "90d", "1w", "2w", "3w", "4w", "8w", "3m", "6m", "1y", "all"]);

function serializeSessions(items: RobustExerciseHistoryItem[]): ExerciseReportSession[] {
  return items.map((item) => ({
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
  }));
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
  const today = todayInCordoba();
  const analysisPeriod = isTrainingAnalysisPeriod(period) ? period : null;
  const currentRange = analysisPeriod ? trainingAnalysisPeriodRange(analysisPeriod, today) : null;
  const compare = sp.compare === "previous" ? "previous" : sp.compare === "exercises" ? "exercises" : null;
  const previousRange = compare === "previous" && analysisPeriod ? previousTrainingAnalysisPeriodRange(analysisPeriod, today) : null;
  const requestedA = typeof sp.a === "string" ? sp.a : exerciseId;
  const requestedB = typeof sp.b === "string" ? sp.b : null;
  const [allExercises, items, previousItems, routineOptions, crossAnalysis] = await Promise.all([
    listExercises({ includeArchived: true }),
    listRobustExerciseHistory({ exerciseId, fromDate: currentRange?.start, toDate: currentRange?.end, routineId: routineId ?? undefined, limit: 100 }),
    previousRange
      ? listRobustExerciseHistory({ exerciseId, fromDate: previousRange.start, toDate: previousRange.end, routineId: routineId ?? undefined, limit: 100 })
      : Promise.resolve([]),
    listRobustExerciseHistoryRoutineOptions(exerciseId),
    compare === "exercises" && analysisPeriod ? getTrainingAnalysis(analysisPeriod) : Promise.resolve(null),
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
  const latestSnapshot = items[0]?.exercise ?? previousItems[0]?.exercise ?? null;
  const exerciseName = exercise?.nombre ?? latestSnapshot?.nombre_snapshot ?? "Ejercicio";
  const sessions = serializeSessions(items);
  const comparison = compare === "previous" && currentRange && previousRange
    ? buildExerciseSessionSelfComparison({
      exerciseId,
      exerciseName,
      currentSessions: sessions,
      previousSessions: serializeSessions(previousItems),
      rangeA: currentRange,
      rangeB: previousRange,
    })
    : compare === "exercises" && crossAnalysis
      ? buildTrainingComparison({ kind: "exercises", analysis: crossAnalysis, requestedA, requestedB })
      : null;

  return <ExerciseReportView
    exerciseId={exerciseId}
    exerciseName={exerciseName}
    muscleLabel={exercise?.muscle_group_label ?? exercise?.grupo_muscular ?? latestSnapshot?.muscle_group_label_snapshot ?? latestSnapshot?.grupo_muscular_snapshot ?? null}
    period={period}
    routineId={routineId}
    routines={routineOptions}
    backHref={cameFromProgress ? `/train/progress?${progressParams.toString()}` : "/train/history?view=exercises"}
    backLabel={cameFromProgress ? progressBackLabel : "Historial"}
    source={cameFromProgress ? "progress" : "history"}
    comparison={comparison}
    progressContext={cameFromProgress ? { view: progressView, routineId: progressRoutine, muscleKey: progressMuscle, query: progressQuery, routineFilter: progressRoutineFilter, muscleFilter: progressMuscleFilter } : undefined}
    sessions={sessions}
  />;
}
