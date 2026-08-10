import type {
  SessionMetadataInput,
  WorkoutExercisePayload,
  WorkoutSessionClient,
  WorkoutSessionClientDetail,
  WorkoutSessionDetail,
  WorkoutSessionExerciseClient,
} from "@/lib/phase2/types";

export function workoutPayloadFromDetail(
  exercise: WorkoutSessionExerciseClient,
): WorkoutExercisePayload {
  const sets = exercise.sets.map((set) => ({
    set_number: set.set_number,
    target_reps: set.target_reps,
    target_weight_kg: set.target_weight_kg,
    actual_reps: set.actual_reps,
    actual_weight_kg: set.actual_weight_kg,
    is_completed: set.is_completed,
    notes: set.notes,
  }));
  return {
    is_completed: sets.some((set) => set.is_completed),
    decision: exercise.decision,
    decision_note: exercise.decision_note ?? "",
    apply_to_routine: exercise.routine_exercise_id
      ? exercise.apply_to_routine
      : false,
    notes: exercise.notes ?? "",
    sets,
  };
}

export function sessionMetadataFromSession(
  session: WorkoutSessionClient,
): SessionMetadataInput {
  return {
    session_name: session.session_name ?? session.routine_name_snapshot ?? "",
    energy_level: session.energy_level,
    performance_level: session.performance_level,
    pain_level: session.pain_level,
    pain_note: session.pain_note ?? "",
    abs_completed: session.abs_completed,
    treadmill_minutes: session.treadmill_minutes,
    treadmill_distance_km: session.treadmill_distance_km,
    treadmill_speed_kmh: session.treadmill_speed_kmh,
    treadmill_incline_percent: session.treadmill_incline_percent,
    notes: session.notes ?? "",
  };
}

export function clientDetailFromWorkoutDetail(
  detail: WorkoutSessionDetail,
): WorkoutSessionClientDetail {
  const session = detail.session;
  return {
    session: {
      id: session.id,
      routine_name_snapshot: session.routine_name_snapshot,
      session_name: session.session_name,
      status: session.status,
      energy_level: session.energy_level,
      performance_level: session.performance_level,
      pain_level: session.pain_level,
      pain_note: session.pain_note,
      abs_completed: session.abs_completed,
      treadmill_minutes: session.treadmill_minutes,
      treadmill_distance_km: session.treadmill_distance_km,
      treadmill_speed_kmh: session.treadmill_speed_kmh,
      treadmill_incline_percent: session.treadmill_incline_percent,
      notes: session.notes,
    },
    logDate: detail.logDate,
    exercises: detail.exercises.map((exercise) => ({
      id: exercise.id,
      routine_exercise_id: exercise.routine_exercise_id,
      nombre_snapshot: exercise.nombre_snapshot,
      grupo_muscular_snapshot: exercise.grupo_muscular_snapshot,
      muscle_group_label_snapshot: exercise.muscle_group_label_snapshot,
      implement_snapshot: exercise.implement_snapshot,
      weight_mode_snapshot: exercise.weight_mode_snapshot,
      decision: exercise.decision,
      decision_note: exercise.decision_note,
      apply_to_routine: exercise.apply_to_routine,
      notes: exercise.notes,
      updated_at: exercise.updated_at,
      sets: exercise.sets.map((set) => ({
        set_number: set.set_number,
        target_reps: set.target_reps,
        target_weight_kg: set.target_weight_kg,
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        is_completed: set.is_completed,
        notes: set.notes,
      })),
    })),
  };
}

export function renumberWorkoutPayload(
  payload: WorkoutExercisePayload,
): WorkoutExercisePayload {
  const sets = payload.sets.map((set, index) => ({
    ...set,
    set_number: index + 1,
  }));
  return {
    ...payload,
    sets,
    is_completed: sets.some((set) => set.is_completed),
  };
}

export function completionStats(payloads: WorkoutExercisePayload[]) {
  let completedSets = 0;
  let totalSets = 0;
  let completedExercises = 0;
  for (const payload of payloads) {
    const done = payload.sets.filter((set) => set.is_completed).length;
    completedSets += done;
    totalSets += payload.sets.length;
    if (done > 0) completedExercises += 1;
  }
  return { completedSets, totalSets, completedExercises };
}
