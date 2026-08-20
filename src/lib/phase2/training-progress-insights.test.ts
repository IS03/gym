import { describe, expect, it } from "vitest";
import {
  formatWeeklyMetric,
  sortedProgressEntries,
  visibleProgressEntries,
  weeklyBarScale,
  weeklyMetricTitle,
  weeklyMetricValue,
} from "./training-progress-insights";
import type { WeeklyTrainingSummary } from "./types";

const week = (overrides: Partial<WeeklyTrainingSummary> = {}): WeeklyTrainingSummary => ({
  weekStart: "2026-08-17", weekEnd: "2026-08-23", sessions: 4, exercises: 8, sets: 72,
  minutes: 310, volumeKg: 18_450, routines: {}, muscleGroups: {}, trainingDays: [], ...overrides,
});

describe("training progress insights", () => {
  it("keeps each weekly chart metric tied to its canonical field", () => {
    expect(weeklyMetricValue(week(), "volume")).toBe(18_450);
    expect(weeklyMetricValue(week(), "sets")).toBe(72);
    expect(weeklyMetricValue(week(), "sessions")).toBe(4);
    expect(weeklyMetricValue(week(), "minutes")).toBe(310);
    expect(weeklyMetricTitle("volume")).toBe("Volumen por semana");
    expect(formatWeeklyMetric(310, "minutes")).toBe("5 h 10 min");
  });

  it("scales bars consistently, including zero, equal values and one week", () => {
    expect(weeklyBarScale(18_450, 18_450)).toBe(100);
    expect(weeklyBarScale(0, 18_450)).toBe(0);
    expect(weeklyBarScale(4, 4)).toBe(100);
    expect(weeklyBarScale(2, 4)).toBe(50);
    expect(weeklyBarScale(2, 0)).toBe(0);
  });

  it("orders distributions and reveals only the top four until expanded", () => {
    const entries = sortedProgressEntries({ Pecho: 9, Abdomen: 14, Espalda: 9, Hombros: 7, Bíceps: 5 });
    expect(entries.map(([name]) => name)).toEqual(["Abdomen", "Espalda", "Pecho", "Hombros", "Bíceps"]);
    expect(visibleProgressEntries(entries, false).map(([name]) => name)).toHaveLength(4);
    expect(visibleProgressEntries(entries, true).map(([name]) => name)).toHaveLength(5);
  });
});
