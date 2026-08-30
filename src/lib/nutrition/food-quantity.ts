import type { Food } from "../phase1/types";
import { parseLocalizedDecimal } from "../localized-decimal";

export const MAX_FOOD_QUANTITY = 1_000_000;

export type ScalableFoodNutrition = Pick<
  Food,
  | "serving_quantity"
  | "serving_unit"
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
>;

export type ScaledFoodNutrition = {
  quantity: number;
  unit: string;
  factor: number;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type FoodQuantityErrorCode =
  | "invalid_quantity"
  | "missing_calories"
  | "zero_calories"
  | "too_small";

export class FoodQuantityError extends Error {
  constructor(
    readonly code: FoodQuantityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FoodQuantityError";
  }
}

export function parseFoodQuantity(value: unknown): number {
  const parsed = parseLocalizedDecimal(value);
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_FOOD_QUANTITY) {
    throw new FoodQuantityError("invalid_quantity", "Ingresá una cantidad válida.");
  }
  return parsed;
}

function roundMacro(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function scaleNullable(value: number | null, factor: number) {
  return value === null ? null : roundMacro(value * factor);
}

export function scaleFoodNutrition(
  food: ScalableFoodNutrition,
  quantityInput: unknown,
): ScaledFoodNutrition {
  const quantity = parseFoodQuantity(quantityInput);
  if (!Number.isFinite(food.serving_quantity) || food.serving_quantity <= 0) {
    throw new FoodQuantityError("invalid_quantity", "La porción base del alimento no es válida.");
  }
  if (food.calories === null) {
    throw new FoodQuantityError(
      "missing_calories",
      "Completá las calorías para poder registrarlo.",
    );
  }
  if (food.calories <= 0) {
    throw new FoodQuantityError(
      "zero_calories",
      "Este alimento no tiene calorías registrables.",
    );
  }

  const factor = quantity / food.serving_quantity;
  const calories = Math.round(food.calories * factor);
  if (calories <= 0) {
    throw new FoodQuantityError(
      "too_small",
      "La cantidad es demasiado pequeña para registrarla con la precisión actual.",
    );
  }

  return {
    quantity,
    unit: food.serving_unit,
    factor,
    calories,
    proteinG: scaleNullable(food.protein_g, factor),
    carbsG: scaleNullable(food.carbs_g, factor),
    fatG: scaleNullable(food.fat_g, factor),
  };
}

export function foodRegistrability(food: Pick<Food, "calories">) {
  if (food.calories === null) return "Completá las calorías para poder registrarlo.";
  if (food.calories <= 0) return "Este alimento no tiene calorías registrables.";
  return null;
}

export function formatFoodQuantity(quantity: number, unit: string) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(quantity)} ${unit}`;
}
