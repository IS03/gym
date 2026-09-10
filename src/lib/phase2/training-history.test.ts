import { describe, expect, it } from "vitest";
import {
  buildTrainingHistoryExerciseDetail,
  filterTrainingHistoryExercises,
  formatTrainingHistoryMark,
  groupCompletedSessionsByDate,
  sortTrainingHistoryExercises,
  toggleTrainingHistoryFilter,
  trainingHistoryFiltersFromSearchParams,
  trainingHistoryListPath,
  type TrainingHistoryExercise,
} from "./training-history";

const entries: TrainingHistoryExercise[] = [
  { id: "press", name: "Press inclinado", muscleGroup: "pecho", muscleLabel: "Pecho", implement: "Mancuernas", weightMode: "Por mancuerna", lastDate: "2026-09-09", sessions: 4, appearances: 4, lastMark: { weightKg: 30, reps: 10 }, bestMark: { weightKg: 32, reps: 8 }, routineIds: ["push", "upper"] },
  { id: "row", name: "Remo con barra", muscleGroup: "espalda", muscleLabel: "Espalda", implement: "Barra", weightMode: "Peso total", lastDate: "2026-09-01", sessions: 7, appearances: 7, lastMark: { weightKg: 70, reps: 10 }, bestMark: { weightKg: 75, reps: 8 }, routineIds: ["pull", "upper"] },
  { id: "curl", name: "Curl martillo", muscleGroup: "bíceps", muscleLabel: "Bíceps", implement: "Mancuernas", weightMode: "Por mancuerna", lastDate: null, sessions: 0, appearances: 0, lastMark: null, bestMark: null, routineIds: [] },
];

describe("training history filters", () => {
  it("defaults to exercises with historical records", () => {
    expect(filterTrainingHistoryExercises(entries, { query: "", routineIds: [], muscleGroups: [], activity: "recorded" }).map((item) => item.id)).toEqual(["press", "row"]);
  });

  it("searches live metadata without accents or case sensitivity", () => {
    expect(filterTrainingHistoryExercises(entries, { query: "BICEPS", routineIds: [], muscleGroups: [], activity: "all" }).map((item) => item.id)).toEqual(["curl"]);
    expect(filterTrainingHistoryExercises(entries, { query: "mancuerna", routineIds: [], muscleGroups: [], activity: "all" }).map((item) => item.id)).toEqual(["press", "curl"]);
  });

  it("uses OR inside routine and muscle categories", () => {
    expect(filterTrainingHistoryExercises(entries, { query: "", routineIds: ["push", "pull"], muscleGroups: [], activity: "recorded" }).map((item) => item.id)).toEqual(["press", "row"]);
    expect(filterTrainingHistoryExercises(entries, { query: "", routineIds: [], muscleGroups: ["pecho", "espalda"], activity: "recorded" }).map((item) => item.id)).toEqual(["press", "row"]);
  });

  it("uses AND between routine and muscle categories", () => {
    expect(filterTrainingHistoryExercises(entries, { query: "", routineIds: ["push", "pull"], muscleGroups: ["pecho"], activity: "recorded" }).map((item) => item.id)).toEqual(["press"]);
  });

  it("combines search with applied filters", () => {
    expect(filterTrainingHistoryExercises(entries, { query: "remo", routineIds: ["pull"], muscleGroups: ["espalda"], activity: "recorded" }).map((item) => item.id)).toEqual(["row"]);
  });

  it("supports all four deterministic orders", () => {
    expect(sortTrainingHistoryExercises(entries, "recent").map((item) => item.id)).toEqual(["press", "row", "curl"]);
    expect(sortTrainingHistoryExercises(entries, "used").map((item) => item.id)).toEqual(["row", "press", "curl"]);
    expect(sortTrainingHistoryExercises(entries, "alpha").map((item) => item.id)).toEqual(["curl", "press", "row"]);
    expect(sortTrainingHistoryExercises(entries, "stale").map((item) => item.id)).toEqual(["row", "press", "curl"]);
  });

  it("toggles multiselect values without duplicates", () => {
    expect(toggleTrainingHistoryFilter(["push"], "pull")).toEqual(["push", "pull"]);
    expect(toggleTrainingHistoryFilter(["push", "pull"], "push")).toEqual(["pull"]);
  });

  it("round-trips visible filter state through history navigation", () => {
    const parsed = trainingHistoryFiltersFromSearchParams({ query: "press", routines: "push,missing", muscles: "pecho", activity: "all", order: "used" }, ["push"]);
    expect(parsed).toEqual({ query: "press", routineIds: ["push"], muscleGroups: ["pecho"], activity: "all", order: "used" });
    expect(trainingHistoryListPath(parsed)).toBe("/train/history?view=exercises&query=press&routines=push&muscles=pecho&activity=all&order=used");
  });

  it("formats weighted, bodyweight and empty historical marks", () => {
    expect(formatTrainingHistoryMark({ weightKg: 17.5, reps: 10 })).toBe("17,5 kg × 10");
    expect(formatTrainingHistoryMark({ weightKg: null, reps: 12 })).toBe("12 reps");
    expect(formatTrainingHistoryMark(null)).toBe("—");
  });
});

describe("training history session groups", () => {
  it("groups civil dates newest first and preserves multiple sessions", () => {
    const session = (id: string, logDate: string, startedAt: string) => ({ id, routineId: null, routineName: id, logDate, startedAt, endedAt: startedAt, durationMilliseconds: 1, exercisesCompleted: 1, completedSets: 1, muscleGroups: [] });
    const groups = groupCompletedSessionsByDate([
      session("pull", "2026-09-08", "2026-09-08T14:00:00Z"),
      session("legs", "2026-09-09", "2026-09-09T14:00:00Z"),
      session("abs", "2026-09-09", "2026-09-09T16:00:00Z"),
    ]);
    expect(groups.map((group) => group.date)).toEqual(["2026-09-09", "2026-09-08"]);
    expect(groups[0]?.sessions.map((item) => item.id)).toEqual(["abs", "legs"]);
  });
});

describe("training history exercise detail", () => {
  const session = (sessionId: string, logDate: string, weight: number, reps: number, rir: number) => ({
    sessionId,
    logDate,
    completedAt: `${logDate}T16:00:00Z`,
    routineId: "push",
    routineName: "PUSH",
    decision: "maintain" as const,
    sets: [{ id: `${sessionId}-set`, set_number: 1, target_reps: reps, target_weight_kg: weight, target_rir: rir, actual_reps: reps, actual_weight_kg: weight, is_completed: true }],
  });

  it("keeps latest and canonical best tied to real historical sessions", () => {
    const detail = buildTrainingHistoryExerciseDetail([
      session("latest", "2026-09-09", 90, 10, 2),
      session("best", "2026-08-22", 95, 8, 1),
    ]);
    expect(detail.latest).toMatchObject({ sessionId: "latest", mark: { weightKg: 90, reps: 10 }, rirValues: [2] });
    expect(detail.best).toMatchObject({ sessionId: "best", mark: { weightKg: 95, reps: 8 } });
    expect(detail.sessions.map((item) => item.sessionId)).toEqual(["latest", "best"]);
  });

  it("allows the latest occurrence to also be the best", () => {
    const detail = buildTrainingHistoryExerciseDetail([
      session("latest-best", "2026-09-09", 100, 8, 1),
      session("older", "2026-09-01", 90, 10, 2),
    ]);
    expect(detail.latest?.sessionId).toBe("latest-best");
    expect(detail.best?.sessionId).toBe("latest-best");
  });
});
