import { describe, expect, it } from "vitest";
import { buildWeeklyTrainingSummaries, formatTrainingMinutes, mondayOfIsoDate } from "./training-progress-summary";
import type { WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "./types";

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-1",
    user_id: "user-1",
    day_log_id: "day-1",
    routine_id: "routine-1",
    routine_name_snapshot: "PUSH",
    session_name: null,
    status: "completed",
    started_at: "2026-08-10T14:00:00.000Z",
    ended_at: "2026-08-10T15:15:00.000Z",
    energy_level: null,
    performance_level: null,
    pain_level: null,
    pain_note: null,
    abs_completed: false,
    treadmill_minutes: null,
    treadmill_distance_km: null,
    treadmill_speed_kmh: null,
    treadmill_incline_percent: null,
    notes: null,
    created_at: "2026-08-10T14:00:00.000Z",
    updated_at: "2026-08-10T15:15:00.000Z",
    ...overrides,
  };
}

function exercise(overrides: Partial<WorkoutSessionExercise> = {}): WorkoutSessionExercise {
  return {
    id: "exercise-1",
    user_id: "user-1",
    workout_session_id: "session-1",
    routine_exercise_id: null,
    exercise_id: "catalog-1",
    exercise_order: 1,
    source_type: "routine",
    nombre_snapshot: "Press inclinado",
    grupo_muscular_snapshot: "pecho",
    muscle_group_label_snapshot: "Pecho",
    implement_snapshot: null,
    weight_mode_snapshot: null,
    rest_min_seconds_snapshot: null,
    rest_max_seconds_snapshot: null,
    planned_sets_count: 3,
    next_adjustment_snapshot: "maintain",
    next_adjustment_note_snapshot: null,
    decision: "maintain",
    decision_note: null,
    apply_to_routine: false,
    notes: null,
    series_reales: null,
    reps_reales: null,
    peso_real: null,
    is_completed: false,
    completed_at: null,
    created_at: "2026-08-10T14:00:00.000Z",
    updated_at: "2026-08-10T15:15:00.000Z",
    ...overrides,
  };
}

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "set-1",
    user_id: "user-1",
    workout_session_exercise_id: "exercise-1",
    set_number: 1,
    target_reps: 10,
    target_weight_kg: 80,
    target_rir: 2,
    actual_reps: 10,
    actual_weight_kg: 80,
    is_completed: true,
    completed_at: "2026-08-10T14:30:00.000Z",
    notes: null,
    created_at: "2026-08-10T14:00:00.000Z",
    updated_at: "2026-08-10T14:30:00.000Z",
    ...overrides,
  };
}

function summaries(input: {
  sessions?: WorkoutSession[];
  exercises?: WorkoutSessionExercise[];
  sets?: WorkoutSet[];
  dates?: Array<[string, string]>;
}) {
  return buildWeeklyTrainingSummaries(
    {
      sessions: input.sessions ?? [session()],
      sessionExercises: input.exercises ?? [exercise()],
      sets: input.sets ?? [set()],
      dateByDayLog: new Map(input.dates ?? [["day-1", "2026-08-10"]]),
    },
    "2026-08-16",
  );
}

describe("buildWeeklyTrainingSummaries", () => {
  it("uses Monday through Sunday and excludes sessions outside the current week", () => {
    expect(mondayOfIsoDate("2026-08-10")).toBe("2026-08-10");
    expect(mondayOfIsoDate("2026-08-16")).toBe("2026-08-10");

    const weeks = summaries({
      sessions: [session()],
      dates: [["day-1", "2026-08-17"]],
    });
    expect(weeks[0]).toMatchObject({ weekStart: "2026-08-10", sessions: 0 });
  });

  it("only includes completed sessions, completed sets, and valid durations", () => {
    const completed = session();
    const inProgress = session({ id: "session-2", day_log_id: "day-2", status: "in_progress", routine_name_snapshot: "PULL" });
    const invalidDuration = session({ id: "session-3", day_log_id: "day-3", started_at: "2026-08-12T16:00:00.000Z", ended_at: "2026-08-12T15:00:00.000Z" });
    const weeks = summaries({
      sessions: [completed, inProgress, invalidDuration],
      exercises: [
        exercise(),
        exercise({ id: "exercise-2", workout_session_id: "session-2", muscle_group_label_snapshot: "Espalda" }),
        exercise({ id: "exercise-3", workout_session_id: "session-3", muscle_group_label_snapshot: "Piernas" }),
      ],
      sets: [
        set(),
        set({ id: "set-2", workout_session_exercise_id: "exercise-1", set_number: 2, is_completed: false }),
        set({ id: "set-3", workout_session_exercise_id: "exercise-2" }),
        set({ id: "set-4", workout_session_exercise_id: "exercise-3" }),
      ],
      dates: [["day-1", "2026-08-10"], ["day-2", "2026-08-10"], ["day-3", "2026-08-12"]],
    });

    expect(weeks[0]).toMatchObject({ sessions: 2, sets: 2, minutes: 75, muscleGroups: { Pecho: 1, Piernas: 1 } });
  });

  it("excluye una sesión descartada de reportes sin tocar otras sesiones", () => {
    const weeks = summaries({
      sessions: [session(), session({ id: "discarded", day_log_id: "day-2", status: "discarded" })],
      exercises: [exercise(), exercise({ id: "exercise-2", workout_session_id: "discarded" })],
      sets: [set(), set({ id: "set-2", workout_session_exercise_id: "exercise-2" })],
      dates: [["day-1", "2026-08-10"], ["day-2", "2026-08-10"]],
    });
    expect(weeks[0]).toMatchObject({ sessions: 1, sets: 1, volumeKg: 800 });
  });

  it("groups routine snapshots, muscles, and duplicate training days", () => {
    const weeks = summaries({
      sessions: [
        session(),
        session({ id: "session-2", day_log_id: "day-2", routine_name_snapshot: "PUSH" }),
        session({ id: "session-3", day_log_id: "day-3", routine_name_snapshot: "PULL" }),
      ],
      exercises: [
        exercise(),
        exercise({ id: "exercise-2", workout_session_id: "session-2", muscle_group_label_snapshot: "Pecho" }),
        exercise({ id: "exercise-3", workout_session_id: "session-3", muscle_group_label_snapshot: null, grupo_muscular_snapshot: "espalda" }),
      ],
      sets: [
        set(),
        set({ id: "set-2", workout_session_exercise_id: "exercise-2" }),
        set({ id: "set-3", workout_session_exercise_id: "exercise-3", target_rir: 0 }),
      ],
      dates: [["day-1", "2026-08-10"], ["day-2", "2026-08-10"], ["day-3", "2026-08-12"]],
    });

    expect(weeks[0]).toMatchObject({
      sessions: 3,
      routines: { PUSH: 2, PULL: 1 },
      muscleGroups: { Pecho: 2, Espalda: 1 },
      trainingDays: ["2026-08-10", "2026-08-12"],
    });
  });

  it("formats weekly duration compactly", () => {
    expect(formatTrainingMinutes(228)).toBe("3 h 48 min");
    expect(formatTrainingMinutes(60)).toBe("1 h");
    expect(formatTrainingMinutes(47)).toBe("47 min");
  });
});
