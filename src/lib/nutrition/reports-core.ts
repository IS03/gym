import type { MealEntryKind } from "@/lib/phase1/types";

export const NUTRITION_REPORT_MAX_DAYS = 366;

export type NutritionReportPreset = "7" | "15" | "30" | "3m" | "1y" | "custom";

export type NutritionReportRange = {
  preset: NutritionReportPreset;
  start: string;
  end: string;
  error: string | null;
};

export type NutritionReportMealFact = {
  day_log_id: string;
  entry_kind: MealEntryKind;
  final_calories: number | null;
  final_protein_g: number | null;
  final_carbs_g: number | null;
  final_fat_g: number | null;
  source_type: string | null;
  deleted_at: string | null;
};

export type NutritionReportWorkoutFact = {
  day_log_id: string;
  status: "in_progress" | "completed" | "discarded";
};

export type NutritionReportDayLogFact = {
  id: string;
  log_date: string;
  total_calories_consumed: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  nutrition_target_kcal_snapshot: number | null;
  protein_target_g_snapshot: number | null;
  water_target_l_snapshot: number | null;
  estimated_expenditure_kcal_snapshot: number | null;
  delta_vs_nutrition_target: number | null;
  energy_balance_kcal: number | null;
  water_l: number | null;
  mate_l: number | null;
  steps: number | null;
  work_effective_snapshot: boolean | null;
  gym_effective_snapshot: boolean | null;
  gym_source_snapshot: string | null;
};

export type NutritionReportDay = {
  date: string;
  dayLogId: string | null;
  hasNutrition: boolean;
  activeMealCount: number;
  imported: boolean;
  calories: number | null;
  targetCalories: number | null;
  targetDeviationKcal: number | null;
  proteinG: number | null;
  targetProteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  expenditureKcal: number | null;
  energyBalanceKcal: number | null;
  waterL: number | null;
  targetWaterL: number | null;
  mateL: number | null;
  steps: number | null;
  workEffective: boolean | null;
  gymEffective: boolean;
  gymSource: string | null;
  hasCompletedWorkout: boolean;
  isToday: boolean;
  isComplete: boolean;
};

export type NutritionReportSummary = {
  registeredDays: number;
  completedRegisteredDays: number;
  currentDayRegistered: boolean;
  calories: {
    averageConsumed: number | null;
    averageTarget: number | null;
    averageTargetDeviation: number | null;
    belowTargetDays: number;
    exactTargetDays: number;
    aboveTargetDays: number;
    comparableDays: number;
  };
  energy: {
    averageExpenditure: number | null;
    accumulatedBalance: number | null;
    comparableDays: number;
  };
  protein: {
    averageConsumed: number | null;
    averageTarget: number | null;
    hitDays: number;
    comparableDays: number;
  };
  carbs: { averageConsumed: number | null; recordedDays: number };
  fat: { averageConsumed: number | null; recordedDays: number };
  hydration: {
    averageWaterL: number | null;
    averageTargetL: number | null;
    hitDays: number;
    comparableDays: number;
  };
  activity: {
    averageSteps: number | null;
    stepDays: number;
    completedWorkoutDays: number;
    workedDays: number;
  };
};

function validIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addIsoDays(date: string, amount: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

/** Subtracts calendar months from an ISO logical date, clamping to the target month's last day. */
export function subtractCalendarMonthsClamped(date: string, months: number) {
  if (!validIsoDate(date) || !Number.isInteger(months) || months < 0) {
    throw new Error("Meses de calendario inválidos.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthIndex = year * 12 + (month - 1) - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear.toString().padStart(4, "0")}-${targetMonth.toString().padStart(2, "0")}-${targetDay.toString().padStart(2, "0")}`;
}

function inclusiveDays(start: string, end: string) {
  return Math.floor(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime())
      / 86_400_000,
  ) + 1;
}

function fallbackRange(today: string, error: string | null = null): NutritionReportRange {
  return { preset: "7", start: addIsoDays(today, -6), end: today, error };
}

export function resolveNutritionReportRange(
  input: { period?: string; from?: string; to?: string },
  today: string,
): NutritionReportRange {
  if (!validIsoDate(today)) throw new Error("Fecha lógica de Córdoba inválida.");
  const period = input.period ?? "7";

  if (period === "7" || period === "15" || period === "30") {
    return {
      preset: period,
      start: addIsoDays(today, -(Number(period) - 1)),
      end: today,
      error: null,
    };
  }

  if (period === "3m" || period === "1y") {
    const months = period === "3m" ? 3 : 12;
    return {
      preset: period,
      start: addIsoDays(subtractCalendarMonthsClamped(today, months), 1),
      end: today,
      error: null,
    };
  }

  if (period !== "custom") return fallbackRange(today);
  if (!validIsoDate(input.from) || !validIsoDate(input.to)) {
    return fallbackRange(today, "Elegí fechas válidas para el período personalizado.");
  }
  if (input.from > input.to) {
    return fallbackRange(today, "La fecha desde no puede ser posterior a la fecha hasta.");
  }
  if (input.from > today) {
    return fallbackRange(today, "El período personalizado todavía no contiene días transcurridos.");
  }

  const end = input.to > today ? today : input.to;
  if (inclusiveDays(input.from, end) > NUTRITION_REPORT_MAX_DAYS) {
    return fallbackRange(today, `El período personalizado admite hasta ${NUTRITION_REPORT_MAX_DAYS} días.`);
  }

  return { preset: "custom", start: input.from, end, error: null };
}

export function listIsoDates(start: string, end: string) {
  const dates: string[] = [];
  for (let current = end; current >= start; current = addIsoDays(current, -1)) {
    dates.push(current);
  }
  return dates;
}

type MealCoverage = {
  count: number;
  hasNutrition: boolean;
  caloriesKnown: boolean;
  proteinKnown: boolean;
  carbsKnown: boolean;
  fatKnown: boolean;
  imported: boolean;
};

export function nutritionMealCoverage(meals: NutritionReportMealFact[]) {
  const result = new Map<string, MealCoverage>();
  for (const meal of meals) {
    if (meal.deleted_at !== null) continue;
    if (meal.entry_kind !== "meal" && meal.entry_kind !== "legacy_daily_summary") continue;
    const values = [meal.final_calories, meal.final_protein_g, meal.final_carbs_g, meal.final_fat_g];
    if (!values.some((value) => typeof value === "number" && Number.isFinite(value))) continue;
    const current = result.get(meal.day_log_id) ?? {
      count: 0,
      hasNutrition: false,
      caloriesKnown: false,
      proteinKnown: false,
      carbsKnown: false,
      fatKnown: false,
      imported: false,
    };
    current.count += 1;
    current.hasNutrition = true;
    current.caloriesKnown ||= meal.final_calories !== null;
    current.proteinKnown ||= meal.final_protein_g !== null;
    current.carbsKnown ||= meal.final_carbs_g !== null;
    current.fatKnown ||= meal.final_fat_g !== null;
    current.imported ||= meal.source_type === "sheet_import";
    result.set(meal.day_log_id, current);
  }
  return result;
}

export function completedWorkoutDayLogIds(workouts: NutritionReportWorkoutFact[]) {
  return new Set(
    workouts.filter((workout) => workout.status === "completed").map((workout) => workout.day_log_id),
  );
}

export function buildNutritionReportDays(input: {
  range: Pick<NutritionReportRange, "start" | "end">;
  today: string;
  dayLogs: NutritionReportDayLogFact[];
  meals: NutritionReportMealFact[];
  workouts: NutritionReportWorkoutFact[];
}): NutritionReportDay[] {
  const logs = new Map(input.dayLogs.map((day) => [day.log_date, day]));
  const coverage = nutritionMealCoverage(input.meals);
  const completedWorkouts = completedWorkoutDayLogIds(input.workouts);

  return listIsoDates(input.range.start, input.range.end).map((date) => {
    const day = logs.get(date);
    const mealData = day ? coverage.get(day.id) : undefined;
    const calories = day && mealData?.caloriesKnown ? day.total_calories_consumed : null;
    const targetCalories = day?.nutrition_target_kcal_snapshot ?? null;
    const expenditureKcal = day?.estimated_expenditure_kcal_snapshot ?? null;
    return {
      date,
      dayLogId: day?.id ?? null,
      hasNutrition: mealData?.hasNutrition ?? false,
      activeMealCount: mealData?.count ?? 0,
      imported: mealData?.imported ?? false,
      calories,
      targetCalories,
      targetDeviationKcal: calories !== null && targetCalories !== null
        ? day?.delta_vs_nutrition_target ?? calories - targetCalories
        : null,
      proteinG: day && mealData?.proteinKnown ? day.total_protein_g : null,
      targetProteinG: day?.protein_target_g_snapshot ?? null,
      carbsG: day && mealData?.carbsKnown ? day.total_carbs_g : null,
      fatG: day && mealData?.fatKnown ? day.total_fat_g : null,
      expenditureKcal,
      energyBalanceKcal: calories !== null && expenditureKcal !== null
        ? day?.energy_balance_kcal ?? calories - expenditureKcal
        : null,
      waterL: day?.water_l ?? null,
      targetWaterL: day?.water_target_l_snapshot ?? null,
      mateL: day?.mate_l ?? null,
      steps: day?.steps ?? null,
      workEffective: day?.work_effective_snapshot ?? null,
      gymEffective: day?.gym_effective_snapshot ?? false,
      gymSource: day?.gym_source_snapshot ?? null,
      hasCompletedWorkout: day ? completedWorkouts.has(day.id) : false,
      isToday: date === input.today,
      isComplete: date < input.today,
    };
  });
}

function average(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
}

export function aggregateNutritionReport(days: NutritionReportDay[]): NutritionReportSummary {
  const registered = days.filter((day) => day.hasNutrition);
  const completed = registered.filter((day) => day.isComplete);
  const calorieDays = completed.filter((day) => day.calories !== null);
  const targetDays = calorieDays.filter((day) => day.targetCalories !== null && day.targetDeviationKcal !== null);
  const balanceDays = calorieDays.filter((day) => day.energyBalanceKcal !== null);
  const proteinDays = completed.filter((day) => day.proteinG !== null);
  const proteinComparable = proteinDays.filter((day) => day.targetProteinG !== null);
  const waterDays = days.filter((day) => day.isComplete && day.waterL !== null);
  const waterComparable = waterDays.filter((day) => day.targetWaterL !== null);
  const stepDays = days.filter((day) => day.isComplete && day.steps !== null);

  return {
    registeredDays: registered.length,
    completedRegisteredDays: completed.length,
    currentDayRegistered: registered.some((day) => day.isToday),
    calories: {
      averageConsumed: average(calorieDays.map((day) => day.calories)),
      averageTarget: average(targetDays.map((day) => day.targetCalories)),
      averageTargetDeviation: average(targetDays.map((day) => day.targetDeviationKcal)),
      belowTargetDays: targetDays.filter((day) => (day.targetDeviationKcal ?? 0) < 0).length,
      exactTargetDays: targetDays.filter((day) => day.targetDeviationKcal === 0).length,
      aboveTargetDays: targetDays.filter((day) => (day.targetDeviationKcal ?? 0) > 0).length,
      comparableDays: targetDays.length,
    },
    energy: {
      averageExpenditure: average(balanceDays.map((day) => day.expenditureKcal)),
      accumulatedBalance: balanceDays.length === 0
        ? null
        : balanceDays.reduce((sum, day) => sum + (day.energyBalanceKcal ?? 0), 0),
      comparableDays: balanceDays.length,
    },
    protein: {
      averageConsumed: average(proteinDays.map((day) => day.proteinG)),
      averageTarget: average(proteinComparable.map((day) => day.targetProteinG)),
      hitDays: proteinComparable.filter((day) => (day.proteinG ?? 0) >= (day.targetProteinG ?? 0)).length,
      comparableDays: proteinComparable.length,
    },
    carbs: {
      averageConsumed: average(completed.map((day) => day.carbsG)),
      recordedDays: completed.filter((day) => day.carbsG !== null).length,
    },
    fat: {
      averageConsumed: average(completed.map((day) => day.fatG)),
      recordedDays: completed.filter((day) => day.fatG !== null).length,
    },
    hydration: {
      averageWaterL: average(waterDays.map((day) => day.waterL)),
      averageTargetL: average(waterComparable.map((day) => day.targetWaterL)),
      hitDays: waterComparable.filter((day) => (day.waterL ?? 0) >= (day.targetWaterL ?? 0)).length,
      comparableDays: waterComparable.length,
    },
    activity: {
      averageSteps: average(stepDays.map((day) => day.steps)),
      stepDays: stepDays.length,
      completedWorkoutDays: days.filter((day) => day.hasCompletedWorkout).length,
      workedDays: days.filter((day) => day.workEffective === true).length,
    },
  };
}
