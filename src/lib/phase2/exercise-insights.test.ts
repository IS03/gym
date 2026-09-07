import { describe, expect, it } from "vitest";
import {
  bestRepsForSession,
  bestWeightForSession,
  buildExerciseReportPoints,
  buildExercisePerformance,
  exerciseSessionVolume,
  filterExerciseDirectory,
  selectedExerciseReportPointIndex,
  summarizeLatestExercisePerformance,
} from "./exercise-insights";
import type { ExerciseDirectoryEntry, ExerciseReportSession, ExerciseReportSet } from "./exercise-insights";

const entry = (overrides: Partial<ExerciseDirectoryEntry> = {}): ExerciseDirectoryEntry => ({
  id: "press", name: "Press inclinado", muscleGroup: "pecho", muscleLabel: "Pecho", lastDate: "2026-08-10", sessions: 2, bestWeightKg: 30, totalVolumeKg: 600, lastDecision: "maintain", lastSets: [], routineIds: ["push", "upper"], ...overrides,
});
const set = (overrides: Partial<ExerciseReportSet> = {}): ExerciseReportSet => ({
  id: "set", set_number: 1, target_reps: 10, target_weight_kg: 20, target_rir: 2, actual_reps: 10, actual_weight_kg: 20, is_completed: true, ...overrides,
});
const reportSession = (overrides: Partial<ExerciseReportSession> = {}): ExerciseReportSession => ({
  sessionId: "session-1", logDate: "2026-08-10", completedAt: "2026-08-10T15:00:00.000Z", routineId: "push", routineName: "PUSH histórico", decision: "maintain", sets: [set()], ...overrides,
});

describe("exercise directory filters", () => {
  const items = [entry(), entry({ id: "curl", name: "Curl bíceps", muscleGroup: "bíceps", muscleLabel: "Bíceps", routineIds: ["pull"] })];
  it("combines muscle, routine and case-insensitive search", () => {
    expect(filterExerciseDirectory(items, { query: "PRESS", muscleGroup: "pecho", routineId: "push" })).toHaveLength(1);
    expect(filterExerciseDirectory(items, { query: "", muscleGroup: "hombros", routineId: "push" })).toHaveLength(0);
  });
  it("keeps multi-routine exercises visible from either membership", () => {
    expect(filterExerciseDirectory(items, { query: "", muscleGroup: "all", routineId: "upper" }).map((item) => item.id)).toEqual(["press"]);
  });

  it("matches the loaded muscle identity without depending on accents", () => {
    expect(filterExerciseDirectory(items, { query: "biceps", muscleGroup: "all", routineId: "all" }).map((item) => item.id)).toEqual(["curl"]);
    expect(filterExerciseDirectory(items, { query: "pecho", muscleGroup: "all", routineId: "all" }).map((item) => item.id)).toEqual(["press"]);
    expect(filterExerciseDirectory(items, { query: "inexistente", muscleGroup: "all", routineId: "all" })).toEqual([]);
  });
});

describe("exercise report metrics", () => {
  it("uses completed sets only for points and volume", () => {
    const sets = [set(), set({ id: "second", actual_reps: 12, actual_weight_kg: 25 }), set({ id: "draft", is_completed: false, actual_reps: 99, actual_weight_kg: 99 })];
    expect(bestWeightForSession(sets)).toBe(25);
    expect(bestRepsForSession(sets)).toBe(12);
    expect(exerciseSessionVolume(sets)).toBe(500);
  });
  it("creates one chronological point per session", () => {
    const points = buildExerciseReportPoints([
      { sessionId: "new", logDate: "2026-08-10", routineId: "push", routineName: "PUSH", decision: "maintain", sets: [set({ actual_weight_kg: 25 })] },
      { sessionId: "old", logDate: "2026-08-03", routineId: "push", routineName: "PUSH", decision: "increase_weight", sets: [set({ actual_weight_kg: 20 })] },
    ]);
    expect(points.map((point) => point.sessionId)).toEqual(["old", "new"]);
    expect(points.map((point) => point.bestWeightKg)).toEqual([20, 25]);
    expect(selectedExerciseReportPointIndex(points, null)).toBe(1);
    expect(selectedExerciseReportPointIndex(points, "old")).toBe(0);
    expect(selectedExerciseReportPointIndex(points, "missing")).toBe(1);
  });
  it("summarizes the latest performance without treating the first of varied sets as representative", () => {
    expect(summarizeLatestExercisePerformance([
      set({ actual_reps: 10, actual_weight_kg: 20, is_completed: true }),
      set({ id: "second", actual_reps: 6, actual_weight_kg: 30, is_completed: true }),
      set({ id: "draft", actual_reps: 99, actual_weight_kg: 99, is_completed: false }),
    ])).toEqual({ completedSets: 2, maxWeightKg: 30, singleSet: null });
    expect(summarizeLatestExercisePerformance([
      set({ actual_reps: 12, actual_weight_kg: 25, is_completed: true }),
    ])).toEqual({ completedSets: 1, maxWeightKg: 25, singleSet: { reps: 12, weightKg: 25 } });
    expect(summarizeLatestExercisePerformance([set({ is_completed: false })])).toMatchObject({ completedSets: 0, maxWeightKg: null, singleSet: null });
  });
});

describe("exercise performance records", () => {
  it("derives personal bests from completed historical sets and keeps reps tied to their load", () => {
    const performance = buildExercisePerformance([
      reportSession({
        sessionId: "old", logDate: "2026-08-10", completedAt: "2026-08-10T15:00:00.000Z",
        sets: [set({ actual_weight_kg: 80, actual_reps: 12 }), set({ id: "old-2", actual_weight_kg: 80, actual_reps: 10 })],
      }),
      reportSession({
        sessionId: "heavy", logDate: "2026-08-20", completedAt: "2026-08-20T15:00:00.000Z",
        sets: [set({ actual_weight_kg: 95, actual_reps: 6 }), set({ id: "heavy-2", actual_weight_kg: 90, actual_reps: 10 }), set({ id: "heavy-3", actual_weight_kg: 90, actual_reps: 10 }), set({ id: "draft", actual_weight_kg: 120, actual_reps: 2, is_completed: false })],
      }),
    ]);

    expect(performance.bestWeight).toMatchObject({ value: 95, weightKg: 95, reps: 6, logDate: "2026-08-20" });
    expect(performance.bestVolume).toMatchObject({ value: 2_370, completedSets: 3, logDate: "2026-08-20" });
    expect(performance.bestReps).toMatchObject({ value: 12, reps: 12, weightKg: 80, logDate: "2026-08-10" });
    expect(performance.recentMarks.every((mark) => mark.value > 0)).toBe(true);
  });

  it("uses the latest occurrence for tied bests but emits a mark event only for strict improvements", () => {
    const performance = buildExercisePerformance([
      reportSession({ sessionId: "first", logDate: "2026-08-10", completedAt: "2026-08-10T15:00:00.000Z", sets: [set({ actual_weight_kg: 90, actual_reps: 8 })] }),
      reportSession({ sessionId: "latest", logDate: "2026-08-20", completedAt: "2026-08-20T15:00:00.000Z", sets: [set({ actual_weight_kg: 90, actual_reps: 9 })] }),
    ]);

    expect(performance.bestWeight).toMatchObject({ sessionId: "latest", value: 90, reps: 9 });
    expect(performance.recentMarks.filter((mark) => mark.kind === "weight")).toHaveLength(1);
  });

  it("keeps null and unloaded data out of performance records instead of inventing zero marks", () => {
    const performance = buildExercisePerformance([
      reportSession({
        sets: [
          set({ actual_weight_kg: null, actual_reps: 15 }),
          set({ id: "zero", actual_weight_kg: 0, actual_reps: 20 }),
          set({ id: "incomplete", actual_weight_kg: 100, actual_reps: 1, is_completed: false }),
        ],
      }),
    ]);

    expect(performance).toEqual({ bestWeight: null, bestVolume: null, bestReps: null, recentMarks: [] });
  });

  it("works from immutable report snapshots and returns no mark for empty history", () => {
    const snapshotPerformance = buildExercisePerformance([
      reportSession({ routineName: "PUSH histórico", sets: [set({ actual_weight_kg: 85, actual_reps: 10 })] }),
    ]);
    expect(snapshotPerformance.bestWeight).toMatchObject({ value: 85, logDate: "2026-08-10" });
    expect(buildExercisePerformance([])).toEqual({ bestWeight: null, bestVolume: null, bestReps: null, recentMarks: [] });
  });
});
