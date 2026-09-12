import { ExerciseReportView } from "@/components/training/exercise-report-view";
import { listExercises } from "@/lib/phase2/training";
import {
  isTrainingAnalysisPeriod,
} from "@/lib/phase2/training-analysis";
import { getPreviousProgressPeriod, resolveProgressPeriod } from "@/lib/progress/analytics";
import { buildExerciseSessionSelfComparison, buildTrainingComparison } from "@/lib/phase2/training-comparison";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import {
  getTrainingExercisesAnalysis,
  listRobustExerciseHistory,
  todayInCordoba,
  type RobustExerciseHistoryItem,
} from "@/lib/phase2/training-robust";
import type { ExerciseReportSession } from "@/lib/phase2/exercise-insights";
import type { ProgressTemporalComparisonReference } from "@/lib/progress/comparisons";
import { HistoryExerciseDetail } from "./history-exercise-detail";

export const dynamic = "force-dynamic";

const PERIODS = new Set(["30d", "90d", "1w", "2w", "3w", "4w", "8w", "3m", "6m", "1y", "custom", "all"]);

function serializeSessions(items: RobustExerciseHistoryItem[]): ExerciseReportSession[] {
  return items.map((item) => ({
    sessionId: item.session.id,
    logDate: item.logDate,
    completedAt: item.session.ended_at,
    routineId: item.session.routine_id,
    routineName: item.session.routine_name_snapshot ?? item.session.session_name ?? "Sesión libre",
    decision: item.exercise.decision,
    weightMode: item.exercise.weight_mode_snapshot,
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
  const cameFromProgress = sp.from === "progress";
  if (!cameFromProgress) {
    const rawLimit = typeof sp.limit === "string" ? Number(sp.limit) : 20;
    const currentLimit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 20), 100) : 20;
    const [allExercises, allHistoryItems] = await Promise.all([
      listExercises({ includeArchived: true }),
      listRobustExerciseHistory({ exerciseId, limit: 500 }),
    ]);
    const exercise = allExercises.find((item) => item.id === exerciseId) ?? null;
    const latestSnapshot = allHistoryItems[0]?.exercise ?? null;
    const requestedReturn = typeof sp.return === "string" ? sp.return : "";
    const returnHref = requestedReturn.startsWith("/train/history?")
      ? requestedReturn
      : "/train/history?view=exercises";
    return <HistoryExerciseDetail
      exerciseId={exerciseId}
      exerciseName={latestSnapshot?.nombre_snapshot ?? exercise?.nombre ?? "Ejercicio"}
      muscleGroup={latestSnapshot?.grupo_muscular_snapshot ?? exercise?.grupo_muscular ?? null}
      muscleLabel={latestSnapshot?.muscle_group_label_snapshot ?? exercise?.muscle_group_label ?? null}
      implement={latestSnapshot?.implement_snapshot ?? exercise?.implement ?? null}
      weightMode={latestSnapshot?.weight_mode_snapshot ?? exercise?.weight_mode ?? null}
      sessions={serializeSessions(allHistoryItems)}
      currentLimit={currentLimit}
      returnHref={returnHref}
    />;
  }
  const rawPeriod = typeof sp.period === "string" && PERIODS.has(sp.period) ? sp.period : "3m";
  const period = rawPeriod === "30d" ? "4w" : rawPeriod === "90d" ? "3m" : rawPeriod;
  const routineId = typeof sp.routine_id === "string" && sp.routine_id ? sp.routine_id : null;
  const today = todayInCordoba();
  const analysisPeriod = isTrainingAnalysisPeriod(period) ? period : null;
  const customFrom = typeof sp.period_from === "string" ? sp.period_from : undefined;
  const customTo = typeof sp.period_to === "string" ? sp.period_to : undefined;
  const resolvedRange = analysisPeriod ? resolveProgressPeriod({ preset: analysisPeriod, from: customFrom, to: customTo }, today) : null;
  const currentRange = resolvedRange && !resolvedRange.error ? resolvedRange.current : null;
  const compare = sp.compare === "previous" ? "previous" : sp.compare === "exercises" ? "exercises" : null;
  const previousRange = currentRange ? getPreviousProgressPeriod(currentRange) : null;
  const requestedA = typeof sp.a === "string" ? sp.a : exerciseId;
  const requestedB = typeof sp.b === "string" ? sp.b : null;
  const referenceDefinition: ProgressTemporalComparisonReference | null = previousRange ? {
    type: "previous_period",
    period: previousRange,
    label: "Período anterior",
  } : null;
  const exerciseData = analysisPeriod && currentRange && referenceDefinition
    ? await getTrainingExercisesAnalysis(analysisPeriod, referenceDefinition, { selectedExerciseId: exerciseId, routineId }, currentRange)
    : null;
  const detail = exerciseData?.exercises.selected ?? null;
  const exercise = exerciseData?.exercises.exercises.find((item) => item.id === exerciseId) ?? null;
  const sessions = detail?.currentSessions ?? [];
  const previousSessions = detail?.referenceSessions ?? [];
  const allHistorySessions = detail?.allSessions ?? [];
  const routineOptions = [...new Map(
    allHistorySessions
      .filter((item) => item.routineId)
      .map((item) => [item.routineId!, {
        id: item.routineId!,
        nombre: item.routineName,
      }]),
  ).values()].sort((left, right) => left.nombre.localeCompare(right.nombre, "es-AR"));
  const progressView = typeof sp.view === "string" && ["general", "routines", "muscles", "exercises"].includes(sp.view) ? sp.view : "general";
  const progressRoutine = typeof sp.routine === "string" ? sp.routine : null;
  const progressMuscle = typeof sp.muscle === "string" ? sp.muscle : null;
  const progressMuscleZone = typeof sp.zone === "string" ? sp.zone : null;
  const progressQuery = typeof sp.query === "string" ? sp.query : null;
  const progressRoutineFilter = typeof sp.routine_filter === "string" ? sp.routine_filter : null;
  const progressMuscleFilter = typeof sp.muscle_filter === "string" ? sp.muscle_filter : null;
  const progressParams = new URLSearchParams({ view: progressView, period });
  if (period === "custom" && currentRange) {
    progressParams.set("from", currentRange.start);
    progressParams.set("to", currentRange.end);
  }
  if (progressRoutine) progressParams.set("routine", progressRoutine);
  if (progressMuscle) progressParams.set("muscle", progressMuscle);
  if (progressMuscleZone) progressParams.set("zone", progressMuscleZone);
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
  const exerciseName = exercise?.name ?? "Ejercicio";
  const comparison = compare === "previous" && currentRange && previousRange
    ? buildExerciseSessionSelfComparison({
      exerciseId,
      exerciseName,
      currentSessions: sessions,
      previousSessions,
      rangeA: currentRange,
      rangeB: previousRange,
    })
    : compare === "exercises" && exerciseData
      ? buildTrainingComparison({ kind: "exercises", analysis: exerciseData.current, requestedA, requestedB })
      : null;

  return <ExerciseReportView
    exerciseId={exerciseId}
    exerciseName={exerciseName}
    muscleLabel={exercise?.muscleLabel ?? null}
    weightMode={detail?.weightMode ?? exercise?.weightMode ?? null}
    period={period}
    routineId={routineId}
    routines={routineOptions}
    backHref={cameFromProgress ? `/train/progress?${progressParams.toString()}` : "/train/history?view=exercises"}
    backLabel={cameFromProgress ? progressBackLabel : "Historial"}
    source={cameFromProgress ? "progress" : "history"}
    range={currentRange}
    comparison={comparison}
    analytics={detail}
    progressContext={cameFromProgress ? { view: progressView, routineId: progressRoutine, muscleKey: progressMuscle, muscleZoneKey: progressMuscleZone, query: progressQuery, routineFilter: progressRoutineFilter, muscleFilter: progressMuscleFilter, periodFrom: currentRange?.start ?? null, periodTo: currentRange?.end ?? null } : undefined}
    sessions={sessions}
  />;
}
