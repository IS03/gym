import { describe, expect, it } from "vitest";
import { buildTrainingAnalysis } from "./training-analysis";
import { buildExerciseSessionSelfComparison, buildTrainingComparison, buildTrainingSelfComparison, comparisonDelta } from "./training-comparison";
import { todayInCordoba } from "./cordoba-date";
import type { ExerciseReportSession } from "./exercise-insights";
import type { MuscleGroup, WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "./types";

function session(id: string, dayLogId: string, routineId: string, routineName: string): WorkoutSession {
  return {
    id, user_id: "user", day_log_id: dayLogId, routine_id: routineId, routine_name_snapshot: routineName, session_name: null, status: "completed",
    started_at: "2026-08-10T14:00:00.000Z", ended_at: "2026-08-10T15:00:00.000Z", energy_level: null, performance_level: null, pain_level: null, pain_note: null, abs_completed: false, treadmill_minutes: null, treadmill_distance_km: null, treadmill_speed_kmh: null, treadmill_incline_percent: null, notes: null, created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T15:00:00.000Z",
  };
}

function exercise(id: string, sessionId: string, exerciseId: string, name: string, muscle: MuscleGroup = "pecho"): WorkoutSessionExercise {
  return {
    id, user_id: "user", workout_session_id: sessionId, routine_exercise_id: null, exercise_id: exerciseId, exercise_order: 1, source_type: "routine", nombre_snapshot: name, grupo_muscular_snapshot: muscle, muscle_group_label_snapshot: muscle === "pecho" ? "Pecho" : "Hombros", implement_snapshot: null, weight_mode_snapshot: null, rest_min_seconds_snapshot: null, rest_max_seconds_snapshot: null, planned_sets_count: 1, next_adjustment_snapshot: "maintain", next_adjustment_note_snapshot: null, decision: "maintain", decision_note: null, apply_to_routine: false, routine_note_snapshot: null, notes: null, series_reales: null, reps_reales: null, peso_real: null, is_completed: true, completed_at: "2026-08-10T15:00:00.000Z", created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T15:00:00.000Z",
  };
}

function set(id: string, exerciseId: string, weight: number | null, reps: number | null): WorkoutSet {
  return {
    id, user_id: "user", workout_session_exercise_id: exerciseId, set_number: 1, target_reps: 10, target_weight_kg: weight, target_rir: 2, actual_reps: reps, actual_weight_kg: weight, is_completed: true, completed_at: "2026-08-10T14:20:00.000Z", notes: null, created_at: "2026-08-10T14:00:00.000Z", updated_at: "2026-08-10T14:20:00.000Z",
  };
}

function source() {
  const sessions = [
    session("current-push", "day-current-push", "push", "PUSH snapshot"),
    session("current-pull", "day-current-pull", "pull", "PULL snapshot"),
    session("current-archived", "day-current-archived", "archived", "Archivada snapshot"),
    session("previous-push", "day-previous-push", "push", "PUSH snapshot viejo"),
  ];
  const sessionExercises = [
    exercise("exercise-current-push", "current-push", "press", "Press histórico"),
    exercise("exercise-current-pull", "current-pull", "row", "Remo histórico", "hombros"),
    exercise("exercise-current-archived", "current-archived", "archived-press", "Press archivado"),
    exercise("exercise-previous-push", "previous-push", "press", "Press histórico viejo"),
  ];
  const sets = [
    set("set-current-push", "exercise-current-push", 90, 10),
    set("set-current-pull", "exercise-current-pull", 50, 12),
    set("set-current-archived", "exercise-current-archived", 70, 8),
    set("set-previous-push", "exercise-previous-push", 80, 8),
  ];
  return {
    sessions,
    sessionExercises,
    sets,
    dateByDayLog: new Map([
      ["day-current-push", "2026-08-10"],
      ["day-current-pull", "2026-08-17"],
      ["day-current-archived", "2026-08-24"],
      ["day-previous-push", "2026-07-10"],
    ]),
  };
}

function analysis(today = "2026-08-30") {
  return buildTrainingAnalysis(source(), {
    today,
    period: "4w",
    routines: [
      { id: "push", nombre: "PUSH actual", is_active: true },
      { id: "pull", nombre: "PULL actual", is_active: true },
      { id: "archived", nombre: "Archivada actual", is_active: false },
    ],
  });
}

describe("training comparisons", () => {
  it("uses the Córdoba calendar day at the timezone boundary", () => {
    expect(todayInCordoba(new Date("2026-09-01T02:30:00.000Z"))).toBe("2026-08-31");
  });

  it("compares equal historical periods by relative bucket and keeps Córdoba-style ISO date boundaries", () => {
    const current = analysis();
    const previous = analysis("2026-08-02");
    const comparison = buildTrainingSelfComparison({ analysis: current, previousAnalysis: previous, subjectType: "general" });
    expect(comparison.rangeA).toMatchObject({ start: "2026-08-03", end: "2026-08-30" });
    expect(comparison.rangeB).toMatchObject({ start: "2026-07-06", end: "2026-08-02" });
    expect(comparison.mode).toBe("self");
    expect(comparison.subjectType).toBe("general");
    expect(comparison.a?.label).toBe("Actual");
    expect(comparison.b?.label).toBe("Anterior");
    expect(comparison.a?.summary.sessions).toBe(3);
    expect(comparison.b?.summary.sessions).toBe(1);
    expect(comparison.timeline).toHaveLength(current.timeline.length);
    expect(comparison.timeline[0]?.label).toBe("Semana 1");
    expect(comparison.timeline[0]?.rangeA.start).not.toBe(comparison.timeline[0]?.rangeB.start);
  });

  it("compares a routine, muscle and exercise only with that same snapshot identity in the previous period", () => {
    const current = analysis();
    const previous = analysis("2026-08-02");
    const routine = buildTrainingSelfComparison({ analysis: current, previousAnalysis: previous, subjectType: "routine", subjectId: "push" });
    expect(routine.subjectId).toBe("push");
    expect(routine.subjectLabel).toBe("PUSH snapshot");
    expect(routine.a?.summary.sessions).toBe(1);
    expect(routine.b?.summary.sessions).toBe(1);

    const muscle = buildTrainingSelfComparison({ analysis: current, previousAnalysis: previous, subjectType: "muscle", subjectId: "pecho" });
    expect(muscle.subjectId).toBe("pecho");
    expect(muscle.metrics).toEqual(["sets", "sessions", "averageSets", "exerciseCount"]);
    expect(muscle.chartMetrics).toEqual(["sets"]);

    const exerciseComparison = buildTrainingSelfComparison({ analysis: current, previousAnalysis: previous, subjectType: "exercise", subjectId: "press" });
    expect(exerciseComparison.subjectId).toBe("press");
    expect(exerciseComparison.a?.bestWeightKg).toBe(90);
    expect(exerciseComparison.b?.bestWeightKg).toBe(80);
    expect(exerciseComparison.options).toEqual([]);
  });

  it("does not fall back to a different object when the same subject has no previous data", () => {
    const comparison = buildTrainingSelfComparison({ analysis: analysis(), previousAnalysis: analysis("2026-08-02"), subjectType: "routine", subjectId: "pull", subjectLabel: "PULL" });
    expect(comparison.a?.summary.sessions).toBe(1);
    expect(comparison.b?.summary).toMatchObject({ sessions: 0, sets: 0, hasData: false });
    expect(comparison.b?.id).toBe("pull:previous");
  });

  it("calculates deltas without infinity, NaN or null-to-zero coercion", () => {
    expect(comparisonDelta(100, 80)).toMatchObject({ absolute: 20, percentage: 25, hasComparableBaseline: true });
    expect(comparisonDelta(80, 100)).toMatchObject({ absolute: -20, percentage: -20, hasComparableBaseline: true });
    expect(comparisonDelta(5, 0)).toEqual({ absolute: 5, percentage: null, hasComparableBaseline: false });
    expect(comparisonDelta(null, 0)).toEqual({ absolute: null, percentage: null, hasComparableBaseline: false });
  });

  it("compares only active routine selectors by default and never normalizes A and B to the same routine", () => {
    const comparison = buildTrainingComparison({ kind: "routines", analysis: analysis(), requestedA: "push", requestedB: "push" });
    expect(comparison.options.map((option) => option.id)).toEqual(["push", "pull"]);
    expect(comparison.a?.label).toBe("PUSH snapshot");
    expect(comparison.b?.id).toBe("pull");
    expect(comparison.metrics).toEqual(["sessions", "sets", "minutes", "volume"]);
    expect(comparison.timeline.every((point) => point.a.volume !== null && point.b.volume !== null)).toBe(true);
  });

  it("compares muscles with series as the primary metric, without presenting muscle volume", () => {
    const comparison = buildTrainingComparison({ kind: "muscles", analysis: analysis(), requestedA: "pecho", requestedB: "hombros" });
    expect(comparison.metrics).toEqual(["sets", "sessions", "averageSets", "exerciseCount"]);
    expect(comparison.metrics).not.toContain("volume");
    expect(comparison.a?.summary.sets).toBe(2);
    expect(comparison.b?.summary.sets).toBe(1);
  });

  it("compares exercise data as raw snapshot measurements with nullable weight/reps buckets", () => {
    const comparison = buildTrainingComparison({ kind: "exercises", analysis: analysis(), requestedA: "press", requestedB: "row" });
    expect(comparison.a?.label).toBe("Press histórico");
    expect(comparison.a?.bestWeightKg).toBe(90);
    expect(comparison.a?.bestReps).toBe(10);
    expect(comparison.metrics).toEqual(["sessions", "bestWeight", "bestReps", "volume"]);
    expect(comparison.timeline.some((point) => point.a.bestWeight === null)).toBe(true);
    expect(comparison.timeline.some((point) => point.a.bestWeight === 90)).toBe(true);
  });

  it("preserves real exercise-session points in short temporal comparisons", () => {
    const reportSession = (sessionId: string, logDate: string, weight: number | null, reps: number | null): ExerciseReportSession => ({
      sessionId,
      logDate,
      routineId: "push",
      routineName: "PUSH snapshot",
      decision: "maintain",
      sets: [{ id: `${sessionId}-set`, set_number: 1, target_reps: 10, target_weight_kg: 80, target_rir: 2, actual_reps: reps, actual_weight_kg: weight, is_completed: true }],
    });
    const comparison = buildExerciseSessionSelfComparison({
      exerciseId: "press",
      exerciseName: "Press histórico",
      currentSessions: [reportSession("current-1", "2026-08-25", 85, 10), reportSession("current-2", "2026-08-29", 90, 8)],
      previousSessions: [reportSession("previous-1", "2026-08-18", 80, 12)],
      rangeA: { start: "2026-08-24", end: "2026-08-30" },
      rangeB: { start: "2026-08-17", end: "2026-08-23" },
    });
    expect(comparison.timeline).toHaveLength(2);
    expect(comparison.timeline[0]).toMatchObject({ label: "Sesión 1", a: { bestWeight: 85, bestReps: 10 }, b: { bestWeight: 80, bestReps: 12 } });
    expect(comparison.timeline[1]).toMatchObject({ label: "Sesión 2", a: { bestWeight: 90, bestReps: 8 }, b: { bestWeight: null, bestReps: null, volume: null } });
    expect(comparison.timeline[1]?.rangeA).toEqual({ start: "2026-08-29", end: "2026-08-29" });
  });
});
