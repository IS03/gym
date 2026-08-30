"use server";

import { revalidatePath } from "next/cache";
import {
  createMeal,
  findRecentPossibleDuplicateMeal,
  quickAddMeal,
  softDeleteMeal,
  updateMeal,
} from "@/lib/phase1/day-log";
import {
  optionalMealMacro,
  requiredMealCalories,
} from "@/lib/nutrition/meal-macros";
import { createMealFromFood } from "@/lib/nutrition/food-entry";
import { FoodQuantityError } from "@/lib/nutrition/food-quantity";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";

function revalidateMealPages() {
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/home");
}

export type QuickAddMealActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type MealMutationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addFoodToDayAction(input: {
  foodId: string;
  quantity: unknown;
  date: string;
}): Promise<MealMutationActionResult> {
  try {
    const auth = await requireAuthenticatedRequestContext();
    await createMealFromFood(input, auth);
    revalidateMealPages();
    return { ok: true };
  } catch (error) {
    if (error instanceof FoodQuantityError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message === "Este alimento ya no está disponible.") {
      return { ok: false, error: error.message };
    }
    console.warn("[food-quantity] add_failed");
    return { ok: false, error: "No pudimos agregar el alimento." };
  }
}

/** La comida se vuelve a leer con ownership en el servidor antes de copiarse. */
export async function quickAddMealAction(
  sourceMealId: string,
): Promise<QuickAddMealActionResult> {
  if (!sourceMealId.trim()) return { ok: false, error: "Comida sugerida inválida." };
  try {
    const auth = await requireAuthenticatedRequestContext();
    await quickAddMeal(sourceMealId, todayInCordoba(), auth);
    revalidateMealPages();
    return { ok: true };
  } catch {
    console.warn("[quick-meal] add_failed");
    return {
      ok: false,
      error: "No pudimos agregar la comida.",
    };
  }
}

function parseCreateMealFromFormData(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = requiredMealCalories(formData.get("final_calories"));
  const protein = optionalMealMacro(formData.get("final_protein_g"), "Proteína");
  const carbs = optionalMealMacro(formData.get("final_carbs_g"), "Carbohidratos");
  const fat = optionalMealMacro(formData.get("final_fat_g"), "Grasas");
  return { date, title, description, calories, protein, carbs, fat };
}

/**
 * true si otra comida reciente coincide en texto y en los cuatro macros.
 */
export async function checkRecentDuplicateMealAction(
  formData: FormData,
): Promise<{ duplicate: boolean }> {
  const { date, title, description, calories, protein, carbs, fat } =
    parseCreateMealFromFormData(formData);
  const found = await findRecentPossibleDuplicateMeal({
    date,
    title: title || undefined,
    description: description || undefined,
    final_calories: calories,
    final_protein_g: protein,
    final_carbs_g: carbs,
    final_fat_g: fat,
  });
  return { duplicate: found != null };
}

export type CreateMealActionResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" };

export async function createMealAction(
  formData: FormData,
): Promise<CreateMealActionResult> {
  const { date, title, description, calories, protein, carbs, fat } =
    parseCreateMealFromFormData(formData);
  const force = String(formData.get("force_duplicate") ?? "") === "1";

  if (!force) {
    const dup = await findRecentPossibleDuplicateMeal({
      date,
      title: title || undefined,
      description: description || undefined,
      final_calories: calories,
      final_protein_g: protein,
      final_carbs_g: carbs,
      final_fat_g: fat,
    });
    if (dup) {
      return { ok: false, reason: "duplicate" };
    }
  }

  await createMeal({
    date,
    title: title || undefined,
    description: description || undefined,
    final_calories: calories,
    final_protein_g: protein,
    final_carbs_g: carbs,
    final_fat_g: fat,
  });

  revalidateMealPages();
  return { ok: true };
}

export async function updateMealAction(formData: FormData): Promise<MealMutationActionResult> {
  try {
    const id = String(formData.get("id") ?? "");
    const date = String(formData.get("date") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const calories = requiredMealCalories(formData.get("final_calories"));
    const protein = optionalMealMacro(formData.get("final_protein_g"), "Proteína");
    const carbs = optionalMealMacro(formData.get("final_carbs_g"), "Carbohidratos");
    const fat = optionalMealMacro(formData.get("final_fat_g"), "Grasas");
    await updateMeal({ id, date, title: title || null, description: description || null, final_calories: calories, final_protein_g: protein, final_carbs_g: carbs, final_fat_g: fat });
    revalidateMealPages();
    return { ok: true };
  } catch {
    console.warn("[today] update_meal_failed");
    return { ok: false, error: "No pudimos guardar los cambios. Intentá nuevamente." };
  }
}

export async function softDeleteMealAction(formData: FormData): Promise<MealMutationActionResult> {
  try {
    const id = String(formData.get("id") ?? "");
    await softDeleteMeal(id);
    revalidateMealPages();
    return { ok: true };
  } catch {
    console.warn("[today] soft_delete_meal_failed");
    return { ok: false, error: "No pudimos eliminar la comida. Intentá nuevamente." };
  }
}
