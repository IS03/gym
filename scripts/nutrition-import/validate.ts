import type {
  DailyOracle,
  NormalizedActivityDay,
  NormalizedMeal,
  ReconciliationResult,
} from "./types.ts";

const TOLERANCES = {
  caloriesKcal: 0,
  macrosG: 0.11,
  // El oráculo muestra líquidos con un decimal; 0,05 L cubre ese redondeo.
  liquidsL: 0.051,
} as const;

type Aggregate = {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

function sumKnown(values: Array<number | null>): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function aggregateMeals(meals: NormalizedMeal[]): Aggregate {
  const active = meals.filter((meal) => meal.active);
  const summaries = active.filter((meal) => meal.entryKind === "legacy_daily_summary");
  const detailed = active.filter((meal) => meal.entryKind === "meal");
  if (summaries.length > 0 && detailed.length > 0) {
    throw new Error("legacy_daily_summary activa coexistiría con comidas detalladas activas");
  }
  if (summaries.length > 1) {
    throw new Error("hay más de un legacy_daily_summary activo para el día");
  }
  const rows = summaries.length === 1 ? summaries : detailed;
  return {
    calories: rows.reduce((sum, meal) => sum + meal.finalCalories, 0),
    proteinG: sumKnown(rows.map((meal) => meal.finalProteinG)),
    carbsG: sumKnown(rows.map((meal) => meal.finalCarbsG)),
    fatG: sumKnown(rows.map((meal) => meal.finalFatG)),
  };
}

function differs(left: number | null, right: number | null, tolerance: number): boolean {
  if (left === null || right === null) return left !== right;
  return Math.abs(left - right) > tolerance;
}

function fieldDiffs(
  oracle: DailyOracle,
  activity: NormalizedActivityDay | undefined,
  aggregate: Aggregate,
): { exact: string[]; tolerated: string[]; sourceWins: string[] } {
  const exact: string[] = [];
  const tolerated: string[] = [];
  const sourceWins: string[] = [];
  const compare = (field: string, left: number | null, right: number | null, tolerance: number) => {
    if (differs(left, right, tolerance)) exact.push(field);
    else if (left !== null && right !== null && left !== right) tolerated.push(field);
  };
  const comparePrimaryNutrition = (
    field: string,
    source: number | null,
    oracleValue: number | null,
    tolerance: number,
  ) => {
    if (source !== null && oracleValue === null) {
      sourceWins.push(field);
      return;
    }
    compare(field, source, oracleValue, tolerance);
  };

  comparePrimaryNutrition("calories", aggregate.calories, oracle.calories, TOLERANCES.caloriesKcal);
  comparePrimaryNutrition("protein_g", aggregate.proteinG, oracle.proteinG, TOLERANCES.macrosG);
  comparePrimaryNutrition("carbs_g", aggregate.carbsG, oracle.carbsG, TOLERANCES.macrosG);
  comparePrimaryNutrition("fat_g", aggregate.fatG, oracle.fatG, TOLERANCES.macrosG);

  if (!activity) {
    exact.push("missing_activity_day");
    return { exact, tolerated, sourceWins };
  }
  compare("water_l", activity.waterL, oracle.waterL, TOLERANCES.liquidsL);
  compare("mate_l", activity.mateL, oracle.mateL, TOLERANCES.liquidsL);
  compare("steps", activity.steps, oracle.steps, 0);
  compare("weight_kg", activity.weightKg, oracle.weightKg, 0.011);
  compare("nutrition_target_kcal", activity.nutritionTargetKcal, oracle.targetKcal, 0);
  compare("estimated_expenditure_kcal", activity.usedExpenditureKcal, oracle.expenditureKcal, 0);
  compare(
    "energy_balance_kcal",
    aggregate.calories - activity.usedExpenditureKcal,
    oracle.energyBalanceKcal,
    0,
  );
  if (activity.work !== oracle.work) exact.push("work");
  if (activity.gym !== oracle.gym) exact.push("gym");
  return { exact, tolerated, sourceWins };
}

export function reconcileDaily(options: {
  meals: NormalizedMeal[];
  activityDays: NormalizedActivityDay[];
  oracle: DailyOracle[];
}): ReconciliationResult {
  const mealsByDate = Map.groupBy(options.meals, (meal) => meal.logDate);
  const activityByDate = new Map(options.activityDays.map((day) => [day.logDate, day]));
  let exactDays = 0;
  let withinToleranceDays = 0;
  let sourceWinsDays = 0;
  const mismatches: ReconciliationResult["mismatches"] = [];
  const warnings: ReconciliationResult["warnings"] = [];

  for (const oracle of options.oracle) {
    let aggregate: Aggregate;
    try {
      aggregate = aggregateMeals(mealsByDate.get(oracle.logDate) ?? []);
    } catch (error) {
      mismatches.push({
        logDate: oracle.logDate,
        fields: [error instanceof Error ? error.message : "invalid_day_composition"],
      });
      continue;
    }
    const differences = fieldDiffs(oracle, activityByDate.get(oracle.logDate), aggregate);
    if (differences.exact.length > 0) {
      mismatches.push({ logDate: oracle.logDate, fields: differences.exact });
    } else if (differences.sourceWins.length > 0) {
      sourceWinsDays += 1;
      warnings.push({
        code: "SOURCE_WINS",
        logDate: oracle.logDate,
        fields: differences.sourceWins,
        message: "La fuente primaria contiene valores y el oráculo derivado está vacío; se preserva la fuente primaria.",
      });
    } else if (differences.tolerated.length > 0) {
      withinToleranceDays += 1;
    } else {
      exactDays += 1;
    }
  }

  return {
    exactDays,
    withinToleranceDays,
    sourceWinsDays,
    mismatchDays: mismatches.length,
    mismatches,
    warnings,
    tolerances: TOLERANCES,
  };
}
