import {
  completedExerciseSets,
  type ExerciseReportSession,
  type ExerciseReportSet,
} from "./exercise-insights";

/** One highlighted latest session plus five previous sessions in the quick sheet. */
export const QUICK_EXERCISE_HISTORY_LIMIT = 6;
export const QUICK_EXERCISE_HISTORY_PREVIOUS_LIMIT = 5;

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

/**
 * A compact "weight · reps" summary is only truthful when every completed set
 * used the same recorded positive load. Mixed loads must stay rendered set by
 * set so the sheet never implies a weight that was not actually used.
 */
export function quickHistoryUniformLoadSummary(
  session: ExerciseReportSession | null,
): string | null {
  if (!session) return null;
  const completed = quickHistoryCompletedSets(session);
  if (completed.length === 0) return null;

  const weights = completed.map((set) => set.actual_weight_kg);
  const firstWeight = weights[0];
  if (
    typeof firstWeight !== "number" ||
    !Number.isFinite(firstWeight) ||
    firstWeight <= 0 ||
    weights.some((weight) => weight !== firstWeight)
  ) {
    return null;
  }

  const reps = completed.map((set) => set.actual_reps);
  if (
    reps.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  ) {
    return null;
  }

  return `${firstWeight} kg · ${reps.join(" / ")} reps`;
}

/** The highlighted latest session is intentionally removed from the list below it. */
export function splitQuickExerciseHistory(
  sessions: readonly ExerciseReportSession[],
): {
  latest: ExerciseReportSession | null;
  previous: ExerciseReportSession[];
} {
  const ordered = recentExerciseHistorySessions(sessions);
  return {
    latest: ordered[0] ?? null,
    previous: ordered.slice(1, QUICK_EXERCISE_HISTORY_PREVIOUS_LIMIT + 1),
  };
}
