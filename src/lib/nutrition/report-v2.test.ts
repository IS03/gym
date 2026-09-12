import { describe, expect, it } from "vitest";

import type { NutritionReportDay } from "./reports-core";
import { buildNutritionReportDayHighlights } from "./report-v2";

function reportDay(date: string, overrides: Partial<NutritionReportDay> = {}): NutritionReportDay {
  return {
    date,
    dayLogId: `day-${date}`,
    hasNutrition: true,
    activeMealCount: 1,
    imported: false,
    calories: 2_000,
    targetCalories: 2_000,
    targetDeviationKcal: 0,
    proteinG: 130,
    targetProteinG: 130,
    carbsG: 220,
    fatG: 65,
    expenditureKcal: 2_300,
    energyBalanceKcal: -300,
    waterL: null,
    targetWaterL: null,
    mateL: null,
    steps: null,
    workEffective: null,
    gymEffective: false,
    gymSource: null,
    hasCompletedWorkout: false,
    goalStage: null,
    isToday: false,
    isComplete: true,
    ...overrides,
  };
}

describe("Nutrition V2 — días que explican el período", () => {
  it("elige hitos descriptivos distintos desde datos reales", () => {
    const highlights = buildNutritionReportDayHighlights([
      reportDay("2026-09-01", { targetDeviationKcal: -15, energyBalanceKcal: -200, proteinG: 120 }),
      reportDay("2026-09-02", { targetDeviationKcal: 80, energyBalanceKcal: -900, proteinG: 140 }),
      reportDay("2026-09-03", { targetDeviationKcal: -40, energyBalanceKcal: 150, proteinG: 210 }),
    ]);

    expect(highlights.map((item) => [item.kind, item.day.date])).toEqual([
      ["closest_target", "2026-09-01"],
      ["largest_balance", "2026-09-02"],
      ["highest_protein", "2026-09-03"],
    ]);
  });

  it("excluye el día actual en curso aunque tenga valores extremos", () => {
    const highlights = buildNutritionReportDayHighlights([
      reportDay("2026-09-11", { targetDeviationKcal: -20, energyBalanceKcal: -400, proteinG: 150 }),
      reportDay("2026-09-12", { isToday: true, isComplete: false, targetDeviationKcal: 0, energyBalanceKcal: -2_000, proteinG: 400 }),
    ]);

    expect(highlights.every((item) => item.day.date === "2026-09-11")).toBe(true);
    expect(highlights).toHaveLength(1);
  });

  it("no convierte días sin registro en candidatos de cero", () => {
    const highlights = buildNutritionReportDayHighlights([
      reportDay("2026-09-10", { hasNutrition: false, calories: null, targetDeviationKcal: null, proteinG: null, energyBalanceKcal: null }),
    ]);
    expect(highlights).toEqual([]);
  });
});
