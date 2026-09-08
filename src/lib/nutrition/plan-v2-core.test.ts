import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  applyWeekdayTargets,
  calculateAgeOnDate,
  configurationForDate,
  estimateBaseExpenditure,
  resolveV2Energy,
  resolveV2EnergyBreakdown,
  resolveV2Targets,
  type NutritionWeekdayTarget,
} from "./plan-v2-core";

const weekdays: NutritionWeekdayTarget[] = [
  { weekday: 1, calorieTargetKcal: 1900, proteinTargetG: 130 },
  { weekday: 2, calorieTargetKcal: 1900, proteinTargetG: 130 },
  { weekday: 3, calorieTargetKcal: 1900, proteinTargetG: 130 },
  { weekday: 4, calorieTargetKcal: 1900, proteinTargetG: 130 },
  { weekday: 5, calorieTargetKcal: 1900, proteinTargetG: 130 },
  { weekday: 6, calorieTargetKcal: 2200, proteinTargetG: 130 },
  { weekday: 7, calorieTargetKcal: 2100, proteinTargetG: 130 },
];

describe("plan nutricional y energía v2", () => {
  it("centraliza factores cotidianos fuera del entrenamiento", () => {
    expect(ACTIVITY_FACTORS).toEqual({ low: 1.2, moderate: 1.25, high: 1.35 });
    expect(estimateBaseExpenditure(1659, "moderate")).toBe(2074);
  });

  it("deriva edad civil sin persistirla", () => {
    expect(calculateAgeOnDate("2003-12-11", "2026-09-08")).toBe(22);
    expect(calculateAgeOnDate("2003-12-11", "2026-12-11")).toBe(23);
  });

  it("aplica el gasto de entrenamiento una sola vez sólo con sesión finalizada", () => {
    expect(resolveV2Energy({ bmrKcal: 1659, activityLevel: "moderate", trainingExpenditureDeltaKcal: 250, workoutStatuses: ["in_progress"] })).toBe(2074);
    expect(resolveV2Energy({ bmrKcal: 1659, activityLevel: "moderate", trainingExpenditureDeltaKcal: 250, workoutStatuses: ["completed", "completed"] })).toBe(2324);
  });

  it("usa una única base automática o personalizada sin mezclar el delta", () => {
    expect(resolveV2EnergyBreakdown({ bmrKcal: 1659, activityLevel: "moderate", baseExpenditureMode: "automatic", customBaseExpenditureKcal: null, trainingExpenditureDeltaKcal: 250, workoutStatuses: ["completed"] })).toMatchObject({ automaticBaseKcal: 2074, baseUsedKcal: 2074, trainingDeltaAppliedKcal: 250, dailyExpenditureKcal: 2324 });
    expect(resolveV2Energy({ bmrKcal: 1659, activityLevel: "moderate", baseExpenditureMode: "custom", customBaseExpenditureKcal: 2100, trainingExpenditureDeltaKcal: 250, workoutStatuses: ["completed", "completed"] })).toBe(2350);
  });

  it("propaga el draft sólo al alcance elegido", () => {
    const values = { calorieTargetKcal: 2000, proteinTargetG: 135 };
    expect(applyWeekdayTargets(weekdays, 4, values, "day").filter((day) => day.calorieTargetKcal === 2000).map((day) => day.weekday)).toEqual([4]);
    expect(applyWeekdayTargets(weekdays, 4, values, "weekdays").filter((day) => day.calorieTargetKcal === 2000).map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(applyWeekdayTargets(weekdays, 4, values, "all").every((day) => day.proteinTargetG === 135)).toBe(true);
  });

  it("resuelve weekday, calorías y agua sin confundir sus deltas", () => {
    expect(resolveV2Targets({ date: "2026-09-07", weekdays, baseWaterL: 2, trainingCalorieDeltaKcal: 200, trainingWaterDeltaL: 0.5, workoutStatuses: [] })).toMatchObject({ calories: 1900, proteinG: 130, waterL: 2 });
    expect(resolveV2Targets({ date: "2026-09-12", weekdays, baseWaterL: 2, trainingCalorieDeltaKcal: 200, trainingWaterDeltaL: 0.5, workoutStatuses: ["completed"] })).toMatchObject({ calories: 2400, proteinG: 130, waterL: 2.5 });
  });

  it("selecciona la versión vigente sin reinterpretar fechas anteriores", () => {
    const periods = [{ effectiveFrom: "2026-08-01", value: 1 }, { effectiveFrom: "2026-09-08", value: 2 }];
    expect(configurationForDate(periods, "2026-09-07")?.value).toBe(1);
    expect(configurationForDate(periods, "2026-09-08")?.value).toBe(2);
  });
});
