import { describe, expect, it } from "vitest";
import {
  bestRepsForSession,
  bestWeightForSession,
  buildExerciseReportPoints,
  exerciseSessionVolume,
  filterExerciseDirectory,
  summarizeLatestExercisePerformance,
} from "./exercise-insights";
import type { ExerciseDirectoryEntry, ExerciseReportSet } from "./exercise-insights";

const entry = (overrides: Partial<ExerciseDirectoryEntry> = {}): ExerciseDirectoryEntry => ({
  id: "press", name: "Press inclinado", muscleGroup: "pecho", muscleLabel: "Pecho", lastDate: "2026-08-10", sessions: 2, bestWeightKg: 30, totalVolumeKg: 600, lastDecision: "maintain", lastSets: [], routineIds: ["push", "upper"], ...overrides,
});
const set = (overrides: Partial<ExerciseReportSet> = {}): ExerciseReportSet => ({
  id: "set", set_number: 1, target_reps: 10, target_weight_kg: 20, target_rir: 2, actual_reps: 10, actual_weight_kg: 20, is_completed: true, ...overrides,
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
