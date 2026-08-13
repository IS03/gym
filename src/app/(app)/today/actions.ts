"use server";

import { revalidatePath } from "next/cache";
import {
  createMeal,
  findRecentPossibleDuplicateMeal,
  softDeleteMeal,
  updateMeal,
} from "@/lib/phase1/day-log";
import {
  optionalMealMacro,
  requiredMealCalories,
} from "@/lib/nutrition/meal-macros";

function revalidateMealPages() {
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/home");
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

export async function updateMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = requiredMealCalories(formData.get("final_calories"));
  const protein = optionalMealMacro(formData.get("final_protein_g"), "Proteína");
  const carbs = optionalMealMacro(formData.get("final_carbs_g"), "Carbohidratos");
  const fat = optionalMealMacro(formData.get("final_fat_g"), "Grasas");

  await updateMeal({
    id,
    title: title ? title : null,
    description: description ? description : null,
    final_calories: calories,
    final_protein_g: protein,
    final_carbs_g: carbs,
    final_fat_g: fat,
  });

  revalidateMealPages();
}

export async function softDeleteMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await softDeleteMeal(id);
  revalidateMealPages();
}
