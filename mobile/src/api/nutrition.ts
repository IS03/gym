import {
  MOBILE_NUTRITION_MEALS_API_PATH,
  MOBILE_NUTRITION_TODAY_API_PATH,
  mobileNutritionMealApiPath,
  type MobileMealDto,
  type MobileMealMutationPayload,
  type MobileMealMutationResponse,
  type MobileNutritionSummaryDto,
  type MobileNutritionTodayResponse,
  type MobileReadResult,
} from "../../../src/lib/mobile-api/contracts";
import {
  defaultMobileApiDependencies,
  fetchMobileApiJson,
  requestMobileApiJson,
  type MobileApiClientDependencies,
  type MobileApiMutationResult,
} from "./client";

export type MobileNutritionTodayResult =
  | { status: "ok"; data: MobileNutritionTodayResponse }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export type MobileNutritionMutationResult =
  | { status: "ok"; data: MobileMealMutationResponse | { deleted: true } }
  | Exclude<MobileApiMutationResult, { status: "ok" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseReadResult<T>(
  value: unknown,
  parse: (data: unknown) => T | null,
): MobileReadResult<T> | null {
  if (!isRecord(value)) return null;
  if (value.status === "unavailable") return { status: "unavailable" };
  if (value.status !== "ok" || !("data" in value)) return null;
  const data = parse(value.data);
  return data === null ? null : { status: "ok", data };
}

function parseSummary(value: unknown): MobileNutritionSummaryDto | null {
  if (
    !isRecord(value) ||
    !isNonNegativeNumber(value.calories) ||
    !isNullableNonNegativeNumber(value.calorieTarget) ||
    !isNonNegativeNumber(value.proteinG) ||
    !isNullableNonNegativeNumber(value.proteinTargetG) ||
    !isNonNegativeNumber(value.carbsG) ||
    !isNonNegativeNumber(value.fatG) ||
    !Number.isInteger(value.mealCount) ||
    Number(value.mealCount) < 0 ||
    !isNullableNonNegativeNumber(value.waterL) ||
    !isNullableNonNegativeNumber(value.waterTargetL) ||
    !isNullableFiniteNumber(value.energyBalanceKcal)
  ) {
    return null;
  }
  return {
    calories: value.calories,
    calorieTarget: value.calorieTarget,
    proteinG: value.proteinG,
    proteinTargetG: value.proteinTargetG,
    carbsG: value.carbsG,
    fatG: value.fatG,
    mealCount: value.mealCount as number,
    waterL: value.waterL,
    waterTargetL: value.waterTargetL,
    energyBalanceKcal: value.energyBalanceKcal,
  };
}

function parseMeal(value: unknown): MobileMealDto | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !(typeof value.title === "string" || value.title === null) ||
    !(typeof value.description === "string" || value.description === null) ||
    !isNullableNonNegativeNumber(value.calories) ||
    !isNullableNonNegativeNumber(value.proteinG) ||
    !isNullableNonNegativeNumber(value.carbsG) ||
    !isNullableNonNegativeNumber(value.fatG) ||
    typeof value.consumedAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    calories: value.calories,
    proteinG: value.proteinG,
    carbsG: value.carbsG,
    fatG: value.fatG,
    consumedAt: value.consumedAt,
    updatedAt: value.updatedAt,
  };
}

function parseMeals(value: unknown): MobileMealDto[] | null {
  if (!Array.isArray(value)) return null;
  const meals = value.map(parseMeal);
  return meals.some((meal) => meal === null)
    ? null
    : (meals as MobileMealDto[]);
}

export function parseMobileNutritionTodayResponse(
  value: unknown,
): MobileNutritionTodayResponse | null {
  if (!isRecord(value) || !isIsoDate(value.date)) return null;
  const summary = parseReadResult(value.summary, parseSummary);
  const meals = parseReadResult(value.meals, parseMeals);
  return summary && meals ? { date: value.date, summary, meals } : null;
}

function parseMealMutationResponse(
  value: unknown,
): MobileMealMutationResponse | null {
  if (!isRecord(value)) return null;
  const meal = parseMeal(value.meal);
  return meal ? { meal } : null;
}

export async function fetchMobileNutritionToday(
  dependencies: MobileApiClientDependencies = defaultMobileApiDependencies,
): Promise<MobileNutritionTodayResult> {
  const result = await fetchMobileApiJson(
    MOBILE_NUTRITION_TODAY_API_PATH,
    dependencies,
  );
  if (result.status !== "ok") return result;
  const data = parseMobileNutritionTodayResponse(result.data);
  return data ? { status: "ok", data } : { status: "unavailable" };
}

async function mealMutation(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  payload: MobileMealMutationPayload | undefined,
  dependencies: MobileApiClientDependencies,
): Promise<MobileNutritionMutationResult> {
  const result = await requestMobileApiJson(
    path,
    {
      method,
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    },
    dependencies,
  );
  if (result.status !== "ok") return result;

  if (method === "DELETE") {
    return isRecord(result.data) && result.data.deleted === true
      ? { status: "ok", data: { deleted: true } }
      : { status: "unavailable" };
  }
  const data = parseMealMutationResponse(result.data);
  return data ? { status: "ok", data } : { status: "unavailable" };
}

export function createMobileNutritionMeal(
  payload: MobileMealMutationPayload,
  dependencies: MobileApiClientDependencies = defaultMobileApiDependencies,
) {
  return mealMutation(
    MOBILE_NUTRITION_MEALS_API_PATH,
    "POST",
    payload,
    dependencies,
  );
}

export function updateMobileNutritionMeal(
  id: string,
  payload: MobileMealMutationPayload,
  dependencies: MobileApiClientDependencies = defaultMobileApiDependencies,
) {
  return mealMutation(
    mobileNutritionMealApiPath(id),
    "PATCH",
    payload,
    dependencies,
  );
}

export function deleteMobileNutritionMeal(
  id: string,
  dependencies: MobileApiClientDependencies = defaultMobileApiDependencies,
) {
  return mealMutation(
    mobileNutritionMealApiPath(id),
    "DELETE",
    undefined,
    dependencies,
  );
}
