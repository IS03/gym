import {
  completedExerciseSets,
  type ExerciseReportSession,
  type ExerciseReportSet,
} from "./exercise-insights";

export const QUICK_EXERCISE_HISTORY_LIMIT = 5;

function sessionSortKey(session: ExerciseReportSession) {
  return session.completedAt ?? `${session.logDate}T12:00:00.000Z`;
}

/**
 * The quick in-session view is intentionally a small, newest-first read model.
 * Callers provide completed historical sessions only; this helper never turns
 * a missing set value into zero.
 */
export function recentExerciseHistorySessions(
  sessions: readonly ExerciseReportSession[],
  limit = QUICK_EXERCISE_HISTORY_LIMIT,
): ExerciseReportSession[] {
  return [...sessions]
    .sort(
      (left, right) =>
        sessionSortKey(right).localeCompare(sessionSortKey(left)) ||
        right.sessionId.localeCompare(left.sessionId),
    )
    .slice(0, Math.max(0, limit));
}

export function quickHistoryCompletedSets(session: ExerciseReportSession): ExerciseReportSet[] {
  return completedExerciseSets(session.sets);
}

export function quickHistorySetLabel(set: ExerciseReportSet): string {
  const reps = set.actual_reps;
  const weight = set.actual_weight_kg;
  const hasWeight = typeof weight === "number" && Number.isFinite(weight) && weight > 0;
  const hasReps = typeof reps === "number" && Number.isFinite(reps);

  if (hasReps && hasWeight) return `${reps} × ${weight} kg`;
  if (hasReps) return `${reps} reps`;
  if (hasWeight) return `${weight} kg`;
  return "Sin carga ni reps registradas";
}

export function quickHistoryLatestSummary(session: ExerciseReportSession | null): string | null {
  if (!session) return null;
  const values = quickHistoryCompletedSets(session).map(quickHistorySetLabel);
  return values.length > 0 ? values.join(" · ") : null;
}
