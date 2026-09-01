import { describe, expect, it } from "vitest";
import { buildTrainingAnalysis, filterTrainingAnalysisExercises, formatTrainingAnalysisMetric, formatTrainingVolumeKg, isTrainingAnalysisPeriod, TRAINING_ANALYSIS_RECENT_EXERCISE_LIMIT } from "./training-analysis";
import { trainingAnalysisComparisonPath, trainingAnalysisExercisePath, trainingAnalysisWorkspacePath } from "./training-analysis-navigation";
import type { WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "./types";

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: "session-1", user_id: "user-1", day_log_id: "day-1", routine_id: "routine-push", routine_name_snapshot: "PUSH histórico", session_name: null, status: "completed", started_at: "2026-08-10T14:00:00.000Z", ended_at: "2026-08-10T15:10:00.000Z", energy_level: null, performance_level: null, pain_level: null, pain_note: null, abs_completed: false, treadmill_minutes: null, treadmill_distance_km: null, treadmill_speed_kmh: null, treadmill_incline_percent: null, notes: null, created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T15:10:00.000Z", ...overrides,
  };
}

function exercise(overrides: Partial<WorkoutSessionExercise> = {}): WorkoutSessionExercise {
  return {
    id: "session-exercise-1", user_id: "user-1", workout_session_id: "session-1", routine_exercise_id: null, exercise_id: "press-machine", exercise_order: 1, source_type: "routine", nombre_snapshot: "Press pecho máquina", grupo_muscular_snapshot: "pecho", muscle_group_label_snapshot: "Pecho", implement_snapshot: null, weight_mode_snapshot: null, rest_min_seconds_snapshot: null, rest_max_seconds_snapshot: null, planned_sets_count: 3, next_adjustment_snapshot: "maintain", next_adjustment_note_snapshot: null, decision: "increase_weight", decision_note: null, apply_to_routine: false, routine_note_snapshot: null, notes: null, series_reales: null, reps_reales: null, peso_real: null, is_completed: true, completed_at: "2026-08-10T15:00:00.000Z", created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T15:00:00.000Z", ...overrides,
  };
}

function set(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "set-1", user_id: "user-1", workout_session_exercise_id: "session-exercise-1", set_number: 1, target_reps: 10, target_weight_kg: 80, target_rir: 2, actual_reps: 10, actual_weight_kg: 80, is_completed: true, completed_at: "2026-08-10T14:25:00.000Z", notes: null, created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T14:25:00.000Z", ...overrides,
  };
}

function analysis(input: {
  sessions?: WorkoutSession[];
  exercises?: WorkoutSessionExercise[];
  sets?: WorkoutSet[];
  dates?: Array<[string, string]>;
  today?: string;
  routines?: Array<{ id: string; nombre: string; is_active?: boolean }>;
  period?: "4w" | "8w" | "3m" | "6m" | "1y";
} = {}) {
  return buildTrainingAnalysis({
    sessions: input.sessions ?? [session()],
    sessionExercises: input.exercises ?? [exercise()],
    sets: input.sets ?? [set()],
    dateByDayLog: new Map(input.dates ?? [["day-1", "2026-08-10"]]),
  }, {
    today: input.today ?? "2026-08-25",
    period: input.period ?? "4w",
    routines: input.routines ?? [{ id: "routine-push", nombre: "PUSH actual" }, { id: "routine-never", nombre: "Rutina sin sesiones" }],
  });
}

describe("training analysis", () => {
  it("builds General only from completed snapshots and real completed sets", () => {
    const result = analysis({
      sessions: [
        session(),
        session({ id: "in-progress", day_log_id: "day-2", status: "in_progress", routine_name_snapshot: "PULL" }),
        session({ id: "discarded", day_log_id: "day-3", status: "discarded", routine_name_snapshot: "PIERNAS" }),
      ],
      exercises: [
        exercise(),
        exercise({ id: "session-exercise-2", workout_session_id: "in-progress", exercise_id: "row", grupo_muscular_snapshot: "espalda", muscle_group_label_snapshot: "Espalda" }),
        exercise({ id: "session-exercise-3", workout_session_id: "discarded", exercise_id: "squat", grupo_muscular_snapshot: "piernas", muscle_group_label_snapshot: "Piernas" }),
      ],
      sets: [
        set(),
        set({ id: "uncompleted", set_number: 2, is_completed: false }),
        set({ id: "in-progress-set", workout_session_exercise_id: "session-exercise-2" }),
        set({ id: "discarded-set", workout_session_exercise_id: "session-exercise-3" }),
      ],
      dates: [["day-1", "2026-08-10"], ["day-2", "2026-08-17"], ["day-3", "2026-08-18"]],
    });

    expect(result.summary).toMatchObject({ sessions: 1, sets: 1, minutes: 70, volumeKg: 800, hasData: true });
    expect(result.muscles.find((item) => item.key === "pecho")?.summary.sets).toBe(1);
    expect(result.muscles.find((item) => item.key === "espalda")?.summary.hasData).toBe(false);
  });

  it("keeps routine, exercise and muscle identity from historical snapshots", () => {
    const result = analysis();
    const routine = result.routines.find((item) => item.id === "routine-push");
    expect(routine?.name).toBe("PUSH histórico");
    expect(routine?.summary.volumeKg).toBe(800);
    expect(routine?.muscles).toEqual([{ key: "pecho", label: "Pecho", sets: 1 }]);
    expect(result.exercises).toMatchObject([{ id: "press-machine", name: "Press pecho máquina", muscleLabel: "Pecho" }]);
  });

  it("keeps a known routine selectable when it has no sessions in the selected period", () => {
    const result = analysis({ period: "4w" });
    const never = result.routines.find((item) => item.id === "routine-never");
    expect(never?.summary).toMatchObject({ sessions: 0, sets: 0, hasData: false });
    expect(never?.timeline.every((point) => point.hasData === false)).toBe(true);
  });

  it("counts one exercise once per session even if it was added twice in that same snapshot", () => {
    const result = analysis({
      exercises: [exercise(), exercise({ id: "session-exercise-2", exercise_order: 2 })],
      sets: [set(), set({ id: "set-2", workout_session_exercise_id: "session-exercise-2", actual_reps: 8, actual_weight_kg: 70 })],
    });
    expect(result.exercises[0]).toMatchObject({ sessions: 1, sets: 2, volumeKg: 1360, bestWeightKg: 80 });
  });

  it("uses bounded weekly or multi-week buckets and never generates negative values", () => {
    const result = analysis({ period: "1y" });
    expect(result.timeline.length).toBeLessThanOrEqual(15);
    for (const point of result.timeline) {
      expect(point.sessions).toBeGreaterThanOrEqual(0);
      expect(point.sets).toBeGreaterThanOrEqual(0);
      expect(point.minutes).toBeGreaterThanOrEqual(0);
      expect(point.volumeKg).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the simple current-week comparison secondary and based on completed snapshots", () => {
    const result = analysis({
      sessions: [session({ day_log_id: "day-current" }), session({ id: "session-prior", day_log_id: "day-prior", started_at: "2026-08-18T14:00:00.000Z", ended_at: "2026-08-18T15:00:00.000Z" })],
      exercises: [exercise({ workout_session_id: "session-1" }), exercise({ id: "session-exercise-prior", workout_session_id: "session-prior" })],
      sets: [set(), set({ id: "set-prior", workout_session_exercise_id: "session-exercise-prior", actual_reps: 8, actual_weight_kg: 70 })],
      dates: [["day-current", "2026-08-25"], ["day-prior", "2026-08-18"]],
    });
    expect(result.weekComparison).toMatchObject({ current: { sessions: 1, sets: 1 }, previous: { sessions: 1, sets: 1 }, isCurrentWeekComplete: false });
  });

  it("keeps a completed current week eligible for its simple comparison", () => {
    const result = analysis({
      today: "2026-08-30",
      sessions: [session({ day_log_id: "day-current" }), session({ id: "session-prior", day_log_id: "day-prior", started_at: "2026-08-18T14:00:00.000Z", ended_at: "2026-08-18T15:00:00.000Z" })],
      exercises: [exercise({ workout_session_id: "session-1" }), exercise({ id: "session-exercise-prior", workout_session_id: "session-prior" })],
      sets: [set(), set({ id: "set-prior", workout_session_exercise_id: "session-exercise-prior", actual_reps: 8, actual_weight_kg: 70 })],
      dates: [["day-current", "2026-08-30"], ["day-prior", "2026-08-18"]],
    });
    expect(result.weekComparison?.isCurrentWeekComplete).toBe(true);
  });

  it("uses only active routines in current selectors while retaining archived historical analysis", () => {
    const result = analysis({
      routines: [{ id: "routine-push", nombre: "PUSH actual", is_active: true }, { id: "routine-archived", nombre: "Rutina archivada", is_active: false }],
      sessions: [session(), session({ id: "archived-session", day_log_id: "day-archived", routine_id: "routine-archived", routine_name_snapshot: "Rutina histórica archivada", started_at: "2026-08-17T14:00:00.000Z", ended_at: "2026-08-17T15:00:00.000Z" })],
      exercises: [exercise(), exercise({ id: "archived-exercise", workout_session_id: "archived-session" })],
      sets: [set(), set({ id: "archived-set", workout_session_exercise_id: "archived-exercise" })],
      dates: [["day-1", "2026-08-10"], ["day-archived", "2026-08-17"]],
    });
    expect(result.activeRoutineIds).toEqual(["routine-push"]);
    expect(result.routines.find((routine) => routine.id === "routine-archived")?.name).toBe("Rutina histórica archivada");
  });

  it("counts distinct exercises for a muscle across repeated historical sessions", () => {
    const result = analysis({
      sessions: [session(), session({ id: "session-2", day_log_id: "day-2", started_at: "2026-08-17T14:00:00.000Z", ended_at: "2026-08-17T15:00:00.000Z" })],
      exercises: [exercise(), exercise({ id: "session-exercise-2", workout_session_id: "session-2" }), exercise({ id: "pec-deck", workout_session_id: "session-2", exercise_id: "pec-deck", nombre_snapshot: "Pec deck pecho" })],
      sets: [set(), set({ id: "set-2", workout_session_exercise_id: "session-exercise-2" }), set({ id: "set-3", workout_session_exercise_id: "pec-deck" })],
      dates: [["day-1", "2026-08-10"], ["day-2", "2026-08-17"]],
    });
    expect(result.muscles.find((muscle) => muscle.key === "pecho")?.summary.exerciseCount).toBe(2);
  });

  it("validates workspace periods, recent limit and Spanish human volume labels", () => {
    expect(isTrainingAnalysisPeriod("8w")).toBe(true);
    expect(isTrainingAnalysisPeriod("90d")).toBe(false);
    expect(TRAINING_ANALYSIS_RECENT_EXERCISE_LIMIT).toBe(6);
    expect(formatTrainingVolumeKg(960)).toBe("960 kg");
    expect(formatTrainingVolumeKg(9_600)).toBe("9,6 mil kg");
    expect(formatTrainingVolumeKg(12_900)).toBe("12,9 mil kg");
    expect(formatTrainingVolumeKg(67_500)).toBe("67,5 mil kg");
    expect(formatTrainingVolumeKg(163_900)).toBe("163,9 mil kg");
    expect(formatTrainingVolumeKg(-41_900)).toBe("−41,9 mil kg");
    expect(formatTrainingAnalysisMetric(12_900, "volume")).toBe("12,9 mil kg");
    expect(formatTrainingAnalysisMetric(0, "sets")).toBe("0 series");
  });

  it("filters the exercise finder by normalized search, routine and muscle without changing historical data", () => {
    const exercises = analysis().exercises;
    expect(filterTrainingAnalysisExercises(exercises, { query: "pecho maquina", routineId: "all", muscleKey: "all" })).toHaveLength(1);
    expect(filterTrainingAnalysisExercises(exercises, { query: "", routineId: "routine-push", muscleKey: "pecho" })).toHaveLength(1);
    expect(filterTrainingAnalysisExercises(exercises, { query: "", routineId: "routine-never", muscleKey: "all" })).toEqual([]);
  });

  it("encodes an analyzable context into URLs so Back can restore the originating routine or muscle", () => {
    const state = { view: "muscles" as const, period: "8w" as const, routineId: null, muscleKey: "pecho" };
    expect(trainingAnalysisWorkspacePath(state)).toBe("/train/progress?view=muscles&period=8w&muscle=pecho");
    expect(trainingAnalysisExercisePath("press-machine", state)).toBe("/train/history/press-machine?from=progress&period=8w&view=muscles&muscle=pecho");
    expect(trainingAnalysisExercisePath("press-machine", { view: "routines", period: "4w", routineId: "routine-push", muscleKey: null })).toContain("routine_id=routine-push");
    const exercisesState = { view: "exercises" as const, period: "8w" as const, routineId: null, muscleKey: null, exerciseQuery: "pecho", exerciseRoutineId: "routine-push", exerciseMuscleKey: "pecho" };
    expect(trainingAnalysisExercisePath("press-machine", exercisesState)).toContain("query=pecho&routine_filter=routine-push&muscle_filter=pecho");
    expect(trainingAnalysisComparisonPath(exercisesState, "exercises", { a: "press-machine", b: "pec-deck" })).toBe("/train/progress?view=exercises&period=8w&query=pecho&routine_filter=routine-push&muscle_filter=pecho&compare=exercises&a=press-machine&b=pec-deck");
  });
});
