import type { CompletedSessionSummary } from "./types";

export type TrainingDaySummary = {
  sessionCount: number;
  exercisesCompleted: number;
  completedSets: number;
  durationMilliseconds: number | null;
};

function validDuration(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0;
}

/**
 * Aggregates only the durations actually recorded by each completed session.
 * A missing duration keeps the day total unknown instead of implying that the
 * gap between two sessions was training time.
 */
export function summarizeTrainingDay(
  sessions: ReadonlyArray<CompletedSessionSummary>,
): TrainingDaySummary {
  const durationKnown = sessions.every((session) => validDuration(session.durationMilliseconds));

  return {
    sessionCount: sessions.length,
    exercisesCompleted: sessions.reduce(
      (total, session) => total + session.exercisesCompleted,
      0,
    ),
    completedSets: sessions.reduce((total, session) => total + session.completedSets, 0),
    durationMilliseconds: durationKnown
      ? sessions.reduce((total, session) => total + (session.durationMilliseconds ?? 0), 0)
      : null,
  };
}

export function orderTrainingDaySessions(
  sessions: ReadonlyArray<CompletedSessionSummary>,
) {
  return [...sessions].sort((left, right) => {
    const leftStart = new Date(left.startedAt).getTime();
    const rightStart = new Date(right.startedAt).getTime();
    const leftValue = Number.isFinite(leftStart) ? leftStart : 0;
    const rightValue = Number.isFinite(rightStart) ? rightStart : 0;
    return leftValue - rightValue || left.id.localeCompare(right.id);
  });
}
