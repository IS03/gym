import "server-only";

import { createMeal } from "@/lib/phase1/day-log";
import type { Food, MealEntry } from "@/lib/phase1/types";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import {
  FoodQuantityError,
  formatFoodQuantity,
  scaleFoodNutrition,
} from "./food-quantity";

export type AddFoodToDayInput = {
  foodId: string;
  quantity: unknown;
  date: string;
};

export async function createMealFromFood(
  input: AddFoodToDayInput,
  context: AuthenticatedRequestContext,
): Promise<MealEntry> {
  const foodId = input.foodId.trim();
  if (!foodId) {
    throw new FoodQuantityError("invalid_quantity", "Elegí un alimento.");
  }

  const { data, error } = await context.supabase
    .from("foods")
    .select("id,user_id,name,description,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,precision_level,source_note,is_active")
    .eq("id", foodId)
    .eq("user_id", context.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[food-quantity] canonical_read_failed", { code: error.code });
    throw new Error("No pudimos leer el alimento.");
  }
  if (!data) {
    throw new Error("Este alimento ya no está disponible.");
  }

  const food = data as Pick<
    Food,
    | "name"
    | "description"
    | "serving_quantity"
    | "serving_unit"
    | "calories"
    | "protein_g"
    | "carbs_g"
    | "fat_g"
    | "precision_level"
    | "source_note"
  >;
  const scaled = scaleFoodNutrition(food, input.quantity);
  const quantityLabel = formatFoodQuantity(scaled.quantity, scaled.unit);
  const description = food.description
    ? `${quantityLabel} · ${food.description}`
    : quantityLabel;

  return createMeal(
    {
      date: input.date,
      title: food.name,
      description,
      final_calories: scaled.calories,
      final_protein_g: scaled.proteinG,
      final_carbs_g: scaled.carbsG,
      final_fat_g: scaled.fatG,
      precision_level: food.precision_level,
      context_type: "food_quantity",
      source_note: food.source_note,
    },
    context,
  );
}
