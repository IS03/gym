import { describe, expect, it } from "vitest";
import { todayInCordoba } from "../phase2/cordoba-date";
import {
  addIsoDays,
  aggregateNutritionReport,
  buildNutritionReportComparison,
  buildNutritionReportDays,
  completedWorkoutDayLogIds,
  nutritionMealCoverage,
  nutritionReportRangeDays,
  previousNutritionReportRange,
  resolveNutritionReportRange,
  subtractCalendarMonthsClamped,
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
    ["15", "2026-08-06"],
    ["30", "2026-07-22"],
  ])("resuelve %s días con extremos inclusivos", (period, start) => {
    expect(resolveNutritionReportRange({ period }, today)).toEqual({
      preset: period,
      start,
      end: today,
      error: null,
    });
  });

  it("resuelve ventanas de calendario de tres meses y un año", () => {
    expect(resolveNutritionReportRange({ period: "3m" }, "2026-08-21")).toMatchObject({ preset: "3m", start: "2026-05-22", end: "2026-08-21" });
    expect(resolveNutritionReportRange({ period: "1y" }, "2026-08-21")).toMatchObject({ preset: "1y", start: "2025-08-22", end: "2026-08-21" });
  });

  it("mantiene los extremos inclusivos pedidos para los seis presets", () => {
    const exampleToday = "2026-08-21";
    expect(resolveNutritionReportRange({ period: "7" }, exampleToday)).toMatchObject({ start: "2026-08-15", end: exampleToday });
    expect(resolveNutritionReportRange({ period: "15" }, exampleToday)).toMatchObject({ start: "2026-08-07", end: exampleToday });
    expect(resolveNutritionReportRange({ period: "30" }, exampleToday)).toMatchObject({ start: "2026-07-23", end: exampleToday });
    expect(resolveNutritionReportRange({ period: "3m" }, exampleToday)).toMatchObject({ start: "2026-05-22", end: exampleToday });
    expect(resolveNutritionReportRange({ period: "1y" }, exampleToday)).toMatchObject({ start: "2025-08-22", end: exampleToday });
  });

  it("clampa meses de calendario al final válido, incluso en febrero bisiesto", () => {
    expect(subtractCalendarMonthsClamped("2026-03-31", 3)).toBe("2025-12-31");
    expect(subtractCalendarMonthsClamped("2026-05-31", 3)).toBe("2026-02-28");
    expect(subtractCalendarMonthsClamped("2028-02-29", 12)).toBe("2027-02-28");
    expect(resolveNutritionReportRange({ period: "3m" }, "2026-05-31").start).toBe("2026-03-01");
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

  it("vuelve de forma segura a siete días ante presets inválidos", () => {
    expect(resolveNutritionReportRange({ period: "14" }, today)).toMatchObject({ preset: "7", start: "2026-08-14", end: today });
    expect(resolveNutritionReportRange({ period: "month" }, today)).toMatchObject({ preset: "7", start: "2026-08-14", end: today });
  });

  it.each([
    [{ start: "2026-09-01", end: "2026-09-07" }, { start: "2026-08-25", end: "2026-08-31" }],
    [{ start: "2026-01-01", end: "2026-01-15" }, { start: "2025-12-17", end: "2025-12-31" }],
    [{ start: "2028-03-01", end: "2028-03-03" }, { start: "2028-02-27", end: "2028-02-29" }],
  ])("crea un período anterior contiguo, sin overlap y de igual duración", (current, previous) => {
    const result = previousNutritionReportRange(current);
    expect(result).toEqual(previous);
    expect(nutritionReportRangeDays(result)).toBe(nutritionReportRangeDays(current));
    expect(addIsoDays(result.end, 1)).toBe(current.start);
  });

  it("aplica la misma regla a un rango personalizado recortado a la fecha lógica de Córdoba", () => {
    const current = resolveNutritionReportRange({
      period: "custom",
      from: "2026-08-29",
      to: "2026-09-12",
    }, "2026-09-07");
    expect(current).toMatchObject({ start: "2026-08-29", end: "2026-09-07" });
    expect(previousNutritionReportRange(current)).toEqual({ start: "2026-08-19", end: "2026-08-28" });
  });

  it("resuelve el corte diario con America/Argentina/Cordoba antes de armar ambos períodos", () => {
    const logicalToday = todayInCordoba(new Date("2026-09-07T02:30:00.000Z"));
    const current = resolveNutritionReportRange({ period: "7" }, logicalToday);
    expect(logicalToday).toBe("2026-09-06");
    expect(current).toMatchObject({ start: "2026-08-31", end: "2026-09-06" });
    expect(previousNutritionReportRange(current)).toEqual({ start: "2026-08-24", end: "2026-08-30" });
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

describe("nutrition report temporal comparison", () => {
  function periodFacts(start: string, end: string, calories: number, balance: number) {
    const dates: string[] = [];
    for (let date = start; date <= end; date = addIsoDays(date, 1)) dates.push(date);
    return {
      dayLogs: dates.map((date) => day(date, {
        total_calories_consumed: calories,
        total_protein_g: calories / 10,
        total_carbs_g: calories / 8,
        total_fat_g: calories / 40,
        energy_balance_kcal: balance,
        water_l: 2,
        mate_l: 0.75,
      })),
      meals: dates.map((date) => meal(date, {
        final_calories: calories,
        final_protein_g: calories / 10,
        final_carbs_g: calories / 8,
        final_fat_g: calories / 40,
      })),
      dates,
    };
  }

  it("compara promedios con promedios, totales con totales y mantiene agua separada de mate", () => {
    const currentRange = { start: "2026-09-01", end: "2026-09-07" };
    const previousRange = previousNutritionReportRange(currentRange);
    const current = periodFacts(currentRange.start, currentRange.end, 2_000, -100);
    const previous = periodFacts(previousRange.start, previousRange.end, 1_800, -200);
    const currentDays = buildNutritionReportDays({ ...current, range: currentRange, today: "2026-09-07", workouts: [workout("2026-09-06", "completed")] });
    const previousDays = buildNutritionReportDays({ ...previous, range: previousRange, today: "2026-09-07", workouts: [] });
    const comparison = buildNutritionReportComparison({ currentRange, previousRange, currentDays, previousDays });
    const rows = new Map(comparison.rows.map((row) => [row.metric, row]));

    expect(rows.get("calories")).toMatchObject({ aggregation: "average", current: 2_000, previous: 1_800, delta: 200 });
    expect(rows.get("energyBalance")).toMatchObject({ aggregation: "total", current: -600, previous: -1_200, delta: 600 });
    expect(rows.get("water")).toMatchObject({ current: 2, previous: 2 });
    expect(rows.get("mate")).toMatchObject({ current: 0.75, previous: 0.75 });
    expect(rows.get("workouts")).toMatchObject({ current: 1, previous: 0, delta: 1 });
  });

  it("compara un período en curso sólo contra las mismas posiciones finalizadas del anterior", () => {
    const currentRange = { start: "2026-09-01", end: "2026-09-07" };
    const previousRange = previousNutritionReportRange(currentRange);
    const current = periodFacts(currentRange.start, currentRange.end, 2_000, -100);
    const previous = periodFacts(previousRange.start, previousRange.end, 1_800, -200);
    const currentDays = buildNutritionReportDays({ ...current, range: currentRange, today: "2026-09-07", workouts: [workout("2026-09-07", "completed")] });
    const previousDays = buildNutritionReportDays({ ...previous, range: previousRange, today: "2026-09-07", workouts: [workout("2026-08-31", "completed")] });
    const comparison = buildNutritionReportComparison({ currentRange, previousRange, currentDays, previousDays });

    expect(comparison.currentSummary.completedRegisteredDays).toBe(6);
    expect(comparison.previousSummary.completedRegisteredDays).toBe(6);
    expect(comparison.currentSummary.activity.completedWorkoutDays).toBe(0);
    expect(comparison.previousSummary.activity.completedWorkoutDays).toBe(0);
    expect(comparison.currentDays).toHaveLength(7);
    expect(comparison.previousDays).toHaveLength(7);
  });

  it("conserva null como ausencia y no fabrica deltas", () => {
    const currentRange = { start: "2026-08-19", end: "2026-08-19" };
    const previousRange = previousNutritionReportRange(currentRange);
    const currentDays = buildNutritionReportDays({ range: currentRange, today, dayLogs: [], meals: [], workouts: [] });
    const previousDays = buildNutritionReportDays({ range: previousRange, today, dayLogs: [], meals: [], workouts: [] });
    const comparison = buildNutritionReportComparison({ currentRange, previousRange, currentDays, previousDays });
    const calories = comparison.rows.find((row) => row.metric === "calories");
    const water = comparison.rows.find((row) => row.metric === "water");
    expect(calories).toMatchObject({ current: null, previous: null, delta: null });
    expect(water).toMatchObject({ current: null, previous: null, delta: null });
  });
});
