import { describe, expect, it } from "vitest";
import {
  aggregateNutritionReport,
  buildNutritionReportDays,
  completedWorkoutDayLogIds,
  nutritionMealCoverage,
  resolveNutritionReportRange,
  type NutritionReportDayLogFact,
  type NutritionReportMealFact,
  type NutritionReportWorkoutFact,
} from "./reports-core";

const today = "2026-08-20";

function day(
  date: string,
  overrides: Partial<NutritionReportDayLogFact> = {},
): NutritionReportDayLogFact {
  return {
    id: `day-${date}`,
    log_date: date,
    total_calories_consumed: 1_800,
    total_protein_g: 130,
    total_carbs_g: 180,
    total_fat_g: 60,
    nutrition_target_kcal_snapshot: 1_900,
    protein_target_g_snapshot: 130,
    water_target_l_snapshot: 2,
    estimated_expenditure_kcal_snapshot: 2_100,
    delta_vs_nutrition_target: -100,
    energy_balance_kcal: -300,
    water_l: 2,
    mate_l: 1,
    steps: 8_000,
    work_effective_snapshot: true,
    gym_effective_snapshot: false,
    gym_source_snapshot: "none",
    ...overrides,
  };
}

function meal(
  date: string,
  overrides: Partial<NutritionReportMealFact> = {},
): NutritionReportMealFact {
  return {
    day_log_id: `day-${date}`,
    entry_kind: "meal",
    final_calories: 1_800,
    final_protein_g: 130,
    final_carbs_g: 180,
    final_fat_g: 60,
    source_type: "manual",
    deleted_at: null,
    ...overrides,
  };
}

function workout(
  date: string,
  status: NutritionReportWorkoutFact["status"],
): NutritionReportWorkoutFact {
  return { day_log_id: `day-${date}`, status };
}

describe("nutrition report ranges", () => {
  it.each([
    ["7", "2026-08-14"],
    ["14", "2026-08-07"],
    ["30", "2026-07-22"],
  ])("resuelve %s días con extremos inclusivos", (period, start) => {
    expect(resolveNutritionReportRange({ period }, today)).toEqual({
      preset: period,
      start,
      end: today,
      error: null,
    });
  });

  it("resuelve este mes usando la fecha lógica de Córdoba recibida", () => {
    expect(resolveNutritionReportRange({ period: "month" }, today)).toEqual({
      preset: "month",
      start: "2026-08-01",
      end: today,
      error: null,
    });
  });

  it("acepta personalizado, recorta futuro y protege el máximo", () => {
    expect(resolveNutritionReportRange({ period: "custom", from: "2026-08-01", to: "2026-09-10" }, today)).toEqual({
      preset: "custom",
      start: "2026-08-01",
      end: today,
      error: null,
    });
    expect(resolveNutritionReportRange({ period: "custom", from: "2025-01-01", to: today }, today).error).toContain("366");
  });
});

describe("nutrition report facts", () => {
  it("no convierte un day_log sin comidas en un día de 0 kcal", () => {
    const [result] = buildNutritionReportDays({
      range: { start: "2026-08-19", end: "2026-08-19" },
      today,
      dayLogs: [day("2026-08-19", { total_calories_consumed: 0 })],
      meals: [],
      workouts: [],
    });
    expect(result).toMatchObject({ hasNutrition: false, calories: null });
  });

  it("cuenta legacy_daily_summary y conserva macros desconocidos como null", () => {
    const date = "2026-08-19";
    const [result] = buildNutritionReportDays({
      range: { start: date, end: date },
      today,
      dayLogs: [day(date, { total_carbs_g: 0, total_fat_g: 0 })],
      meals: [meal(date, {
        entry_kind: "legacy_daily_summary",
        final_carbs_g: null,
        final_fat_g: null,
        source_type: "sheet_import",
      })],
      workouts: [],
    });
    expect(result).toMatchObject({ hasNutrition: true, imported: true, carbsG: null, fatG: null });
  });

  it("ignora comidas con soft delete, incluso si contienen calorías", () => {
    const coverage = nutritionMealCoverage([
      meal("2026-08-19", { deleted_at: "2026-08-20T00:00:00Z" }),
    ]);
    expect(coverage.size).toBe(0);
  });

  it("sólo reconoce workout_sessions completed", () => {
    const ids = completedWorkoutDayLogIds([
      workout("2026-08-17", "completed"),
      workout("2026-08-18", "in_progress"),
      workout("2026-08-19", "discarded"),
    ]);
    expect([...ids]).toEqual(["day-2026-08-17"]);
  });
});

describe("nutrition report aggregation", () => {
  it("excluye hoy de promedios finales y del balance acumulado", () => {
    const days = buildNutritionReportDays({
      range: { start: "2026-08-19", end: today },
      today,
      dayLogs: [
        day("2026-08-19", { total_calories_consumed: 1_800, energy_balance_kcal: -300 }),
        day(today, { total_calories_consumed: 567, energy_balance_kcal: -1_533 }),
      ],
      meals: [meal("2026-08-19"), meal(today, { final_calories: 567 })],
      workouts: [],
    });
    const summary = aggregateNutritionReport(days);
    expect(summary.calories.averageConsumed).toBe(1_800);
    expect(summary.energy.accumulatedBalance).toBe(-300);
    expect(summary.currentDayRegistered).toBe(true);
    expect(summary.completedRegisteredDays).toBe(1);
  });

  it("ignora NULL en macros y pasos en vez de convertirlos en cero", () => {
    const days = buildNutritionReportDays({
      range: { start: "2026-08-18", end: "2026-08-19" },
      today,
      dayLogs: [
        day("2026-08-18", { total_carbs_g: 0, steps: null }),
        day("2026-08-19", { total_carbs_g: 80, steps: 10_000 }),
      ],
      meals: [
        meal("2026-08-18", { final_carbs_g: null }),
        meal("2026-08-19", { final_carbs_g: 80 }),
      ],
      workouts: [],
    });
    const summary = aggregateNutritionReport(days);
    expect(summary.carbs).toEqual({ averageConsumed: 80, recordedDays: 1 });
    expect(summary.activity.averageSteps).toBe(10_000);
    expect(summary.activity.stepDays).toBe(1);
  });

  it("calcula hits de proteína y agua sólo sobre días comparables", () => {
    const days = buildNutritionReportDays({
      range: { start: "2026-08-17", end: "2026-08-19" },
      today,
      dayLogs: [
        day("2026-08-17", { total_protein_g: 130, water_l: 2 }),
        day("2026-08-18", { total_protein_g: 100, water_l: 1.5 }),
        day("2026-08-19", { total_protein_g: 150, protein_target_g_snapshot: null, water_l: null }),
      ],
      meals: [meal("2026-08-17"), meal("2026-08-18"), meal("2026-08-19")],
      workouts: [],
    });
    const summary = aggregateNutritionReport(days);
    expect(summary.protein).toMatchObject({ hitDays: 1, comparableDays: 2 });
    expect(summary.hydration).toMatchObject({ hitDays: 1, comparableDays: 2, averageWaterL: 1.75 });
  });

  it("mantiene separadas desviación al target y balance energético", () => {
    const days = buildNutritionReportDays({
      range: { start: "2026-08-19", end: "2026-08-19" },
      today,
      dayLogs: [day("2026-08-19", {
        total_calories_consumed: 2_000,
        nutrition_target_kcal_snapshot: 1_900,
        estimated_expenditure_kcal_snapshot: 2_300,
        delta_vs_nutrition_target: 100,
        energy_balance_kcal: -300,
      })],
      meals: [meal("2026-08-19", { final_calories: 2_000 })],
      workouts: [],
    });
    const summary = aggregateNutritionReport(days);
    expect(summary.calories.averageTargetDeviation).toBe(100);
    expect(summary.calories.aboveTargetDays).toBe(1);
    expect(summary.energy.accumulatedBalance).toBe(-300);
  });

  it("cuenta entrenamiento efectivo sólo desde sesiones completed", () => {
    const days = buildNutritionReportDays({
      range: { start: "2026-08-18", end: "2026-08-19" },
      today,
      dayLogs: [
        day("2026-08-18", { gym_effective_snapshot: true, gym_source_snapshot: "override" }),
        day("2026-08-19", { gym_effective_snapshot: true, gym_source_snapshot: "workout" }),
      ],
      meals: [],
      workouts: [workout("2026-08-18", "discarded"), workout("2026-08-19", "completed")],
    });
    expect(aggregateNutritionReport(days).activity.completedWorkoutDays).toBe(1);
    expect(days[1].gymEffective).toBe(true);
  });
});
