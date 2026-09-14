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
import {
  addAdjustedSavedMeal,
  getSavedMealAdjustment,
  quickAddSavedMeal,
  SavedMealProductError,
  saveSuggestedMeal,
} from "@/lib/nutrition/saved-meals";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { measurePerformance } from "@/lib/request-performance";

type TodayAuth = Awaited<ReturnType<typeof requireAuthenticatedRequestContext>>;

function measuredMealWrite<T>(
  auth: TodayAuth,
  operation: string,
  write: () => Promise<T>,
) {
  return measurePerformance({
    route: "/today",
    operation,
    layer: "database",
    ...auth.requestPerformance,
  }, write);
}

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
  idempotencyKey?: string;
}): Promise<MealMutationActionResult> {
  try {
    const auth = await requireAuthenticatedRequestContext();
    await measuredMealWrite(auth, "nutrition.create-food-meal", () =>
      createMealFromFood(input, auth));
    revalidateMealPages();
    return { ok: true };
  } catch (error) {
    if (error instanceof FoodQuantityError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.message === "Este alimento ya no está disponible.") {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No pudimos agregar el alimento." };
  }
}

/** La comida se vuelve a leer con ownership en el servidor antes de copiarse. */
export async function quickAddMealAction(
  sourceMealId: string,
  idempotencyKey?: string,
): Promise<QuickAddMealActionResult> {
  if (!sourceMealId.trim()) return { ok: false, error: "Comida sugerida inválida." };
  try {
    const auth = await requireAuthenticatedRequestContext();
    await measuredMealWrite(auth, "nutrition.quick-add-meal", () =>
      quickAddMeal(sourceMealId, todayInCordoba(), auth, idempotencyKey));
    revalidateMealPages();
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "No pudimos agregar la comida.",
    };
  }
}

export async function quickAddSavedMealAction(input: { savedMealId: string; date: string; idempotencyKey?: string }) {
  try {
    const auth = await requireAuthenticatedRequestContext();
    await measuredMealWrite(auth, "nutrition.quick-add-saved-meal", () =>
      quickAddSavedMeal(input.savedMealId, input.date, auth, input.idempotencyKey));
    revalidateMealPages();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos agregar la comida habitual.",
    };
  }
}

export async function addAdjustedSavedMealAction(input: {
  savedMealId: string;
  date: string;
  items: Array<{ itemId: string; quantity: string }>;
  idempotencyKey?: string;
}) {
  try {
    const auth = await requireAuthenticatedRequestContext();
    await measuredMealWrite(auth, "nutrition.add-adjusted-saved-meal", () =>
      addAdjustedSavedMeal(input, auth));
    revalidateMealPages();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos agregar la comida ajustada.",
    };
  }
}

export async function getSavedMealAdjustmentAction(savedMealId: string) {
  try {
    return { ok: true as const, meal: await getSavedMealAdjustment(savedMealId) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos abrir esta comida habitual.",
    };
  }
}

export async function saveSuggestedMealAction(sourceMealId: string) {
  try {
    const auth = await requireAuthenticatedRequestContext();
    const meal = await saveSuggestedMeal(sourceMealId, todayInCordoba(), auth);
    revalidatePath("/settings/nutrition");
    revalidatePath("/settings/nutrition/meals");
    revalidatePath("/today");
    return {
      ok: true as const,
      meal: {
        id: meal.id,
        name: meal.name,
        description: meal.description,
        template_type: meal.template_type,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        is_active: meal.is_active,
        itemCount: meal.items.length,
      },
    };
  } catch (error) {
    console.warn("[saved-meals] suggestion_save_failed");
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos guardar la comida habitual.",
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

  const auth = await requireAuthenticatedRequestContext();
  await measuredMealWrite(auth, "nutrition.create-meal", () => createMeal({
    date,
    title: title || undefined,
    description: description || undefined,
    final_calories: calories,
    final_protein_g: protein,
    final_carbs_g: carbs,
    final_fat_g: fat,
    idempotencyKey: String(formData.get("idempotency_key") ?? "") || undefined,
  }, auth));

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
    const auth = await requireAuthenticatedRequestContext();
    await measuredMealWrite(auth, "nutrition.update-meal", () => updateMeal({ id, date, title: title || null, description: description || null, final_calories: calories, final_protein_g: protein, final_carbs_g: carbs, final_fat_g: fat }, auth));
    revalidateMealPages();
    return { ok: true };
  } catch {
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
