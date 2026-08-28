import type { WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "@/lib/phase2/types";

export type DailyHistorySession = {
  id: string;
  name: string;
  durationMilliseconds: number | null;
  completedSets: number;
  completedExercises: number;
  volumeKg: number;
};

export function sessionDurationMilliseconds(session: Pick<WorkoutSession, "started_at" | "ended_at">) {
  if (!session.started_at || !session.ended_at) return null;
  const milliseconds = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime();
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

/** Misma semántica que Training Progress: únicamente sets completed y reps × peso reales. */
export function completedSetVolume(set: Pick<WorkoutSet, "actual_reps" | "actual_weight_kg">) {
  return (set.actual_reps ?? 0) * (set.actual_weight_kg ?? 0);
}

export function summarizeDailyHistorySessions(input: {
  sessions: WorkoutSession[];
  exercises: WorkoutSessionExercise[];
  sets: WorkoutSet[];
}): DailyHistorySession[] {
  const exercisesBySession = new Map<string, WorkoutSessionExercise[]>();
  for (const exercise of input.exercises) {
    const items = exercisesBySession.get(exercise.workout_session_id) ?? [];
    items.push(exercise);
    exercisesBySession.set(exercise.workout_session_id, items);
  }
  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const set of input.sets) {
    if (!set.is_completed) continue;
    const items = setsByExercise.get(set.workout_session_exercise_id) ?? [];
    items.push(set);
    setsByExercise.set(set.workout_session_exercise_id, items);
  }

  return input.sessions
    .filter((session) => session.status === "completed")
    .map((session) => {
      const exercises = exercisesBySession.get(session.id) ?? [];
      const completedSets = exercises.flatMap((exercise) => setsByExercise.get(exercise.id) ?? []);
      return {
        id: session.id,
        name: session.routine_name_snapshot ?? session.session_name ?? "Sesión libre",
        durationMilliseconds: sessionDurationMilliseconds(session),
        completedSets: completedSets.length,
        completedExercises: exercises.filter((exercise) => (setsByExercise.get(exercise.id)?.length ?? 0) > 0).length,
        volumeKg: completedSets.reduce((total, set) => total + completedSetVolume(set), 0),
      };
    });
}
