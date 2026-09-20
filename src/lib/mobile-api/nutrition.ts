import {
  optionalMealMacro,
  requiredMealCalories,
} from "../nutrition/meal-macros";
import type { NutritionContext } from "../nutrition/types";
import type { DayLog, MealEntry } from "../phase1/types";
import type { ReadResult } from "../resilient-read";
import { MobileApiValidationError } from "./auth";
import type {
  MobileMealDto,
  MobileMealMutationPayload,
  MobileNutritionTodayResponse,
  MobileReadResult,
} from "./contracts";

export type MobileNutritionSummarySource = {
  dayLog: DayLog;
  mealCount: number;
  context: NutritionContext;
};

export type MobileNutritionTodaySources = {
  summary: ReadResult<MobileNutritionSummarySource>;
  meals: ReadResult<MealEntry[]>;
};

export class MobileNutritionUnavailableError extends Error {
  constructor() {
    super("Mobile Nutrition unavailable");
    this.name = "MobileNutritionUnavailableError";
  }
}

function mapReadResult<T, U>(
  result: ReadResult<T>,
  transform: (data: T) => U,
): MobileReadResult<U> {
  return result.status === "ok"
    ? { status: "ok", data: transform(result.data) }
    : { status: "unavailable" };
}

export function mobileMealDto(meal: MealEntry): MobileMealDto {
  return {
    id: meal.id,
    title: meal.title,
    description: meal.description,
    calories: meal.final_calories,
    proteinG: meal.final_protein_g,
    carbsG: meal.final_carbs_g,
    fatG: meal.final_fat_g,
    consumedAt: meal.consumed_at,
    updatedAt: meal.updated_at,
  };
}

export function buildMobileNutritionTodayResponse(
  date: string,
  sources: MobileNutritionTodaySources,
): MobileNutritionTodayResponse {
  if (
    sources.summary.status === "unavailable" &&
    sources.meals.status === "unavailable"
  ) {
    throw new MobileNutritionUnavailableError();
  }

  return {
    date,
    summary: mapReadResult(
      sources.summary,
      ({ dayLog, mealCount, context }) => ({
        calories: dayLog.total_calories_consumed ?? 0,
        calorieTarget: context.targets.calories,
        proteinG: dayLog.total_protein_g ?? 0,
        proteinTargetG: context.targets.proteinG,
        carbsG: dayLog.total_carbs_g ?? 0,
        fatG: dayLog.total_fat_g ?? 0,
        mealCount,
        waterL: context.consumption.waterL,
        waterTargetL: context.targets.waterL,
        energyBalanceKcal: context.metrics.energyBalanceKcal,
      }),
    ),
    meals: mapReadResult(sources.meals, (meals) => meals.map(mobileMealDto)),
  };
}

function requiredString(
  value: unknown,
  field: string,
  options: { allowEmpty?: boolean } = {},
) {
  if (typeof value !== "string") {
    throw new MobileApiValidationError(`${field} no es válido.`);
  }
  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new MobileApiValidationError(`${field} es obligatorio.`);
  }
  return normalized;
}

function safeCalories(value: unknown) {
  try {
    return requiredMealCalories(value);
  } catch {
    throw new MobileApiValidationError(
      "Las calorías son obligatorias y deben ser un número entero mayor a 0.",
    );
  }
}

function safeMacro(
  value: unknown,
  field: "Proteína" | "Carbohidratos" | "Grasas",
) {
  try {
    return optionalMealMacro(value, field);
  } catch {
    throw new MobileApiValidationError(
      `${field} debe ser un número válido y no negativo.`,
    );
  }
}

export type ParsedMobileMealMutation = {
  title: string | null;
  description: string | null;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  idempotencyKey?: string;
};

export function parseMobileMealMutation(
  value: unknown,
  options: { requireIdempotencyKey: boolean },
): ParsedMobileMealMutation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MobileApiValidationError("La comida no es válida.");
  }

  const input = value as Partial<Record<keyof MobileMealMutationPayload, unknown>>;
  const title = requiredString(input.title, "El título", { allowEmpty: true });
  const description = requiredString(input.description, "La descripción", {
    allowEmpty: true,
  });
  const idempotencyKey = options.requireIdempotencyKey
    ? requiredString(input.idempotencyKey, "La operación")
    : undefined;
  if (
    idempotencyKey &&
    (idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey))
  ) {
    throw new MobileApiValidationError("La operación no es válida.");
  }

  return {
    title: title || null,
    description: description || null,
    calories: safeCalories(input.calories),
    proteinG: safeMacro(input.proteinG, "Proteína"),
    carbsG: safeMacro(input.carbsG, "Carbohidratos"),
    fatG: safeMacro(input.fatG, "Grasas"),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

export function parseMobileMealId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new MobileApiValidationError("La comida no es válida.");
  }
  return value;
}
