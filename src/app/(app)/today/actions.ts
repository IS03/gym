"use server";

import { revalidatePath } from "next/cache";
import {
  createMeal,
  findRecentPossibleDuplicateMeal,
  softDeleteMeal,
  updateMeal,
} from "@/lib/phase1/day-log";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredCalories(value: FormDataEntryValue | null): number {
  const n = parseNumber(value);
  if (n === null || n <= 0) {
    throw new Error("Las calorías son obligatorias y deben ser mayores a 0.");
  }
  return Math.trunc(n);
}

function parseCreateMealFromFormData(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = parseRequiredCalories(formData.get("final_calories"));
  const protein = parseNumber(formData.get("final_protein_g"));
  return { date, title, description, calories, protein };
}

/**
 * true si ahora mismo otra comida en el último minuto coincide (título o descripción, kcal, proteína).
 */
export async function checkRecentDuplicateMealAction(
  formData: FormData,
): Promise<{ duplicate: boolean }> {
  const { date, title, description, calories, protein } =
    parseCreateMealFromFormData(formData);
  const found = await findRecentPossibleDuplicateMeal({
    date,
    title: title || undefined,
    description: description || undefined,
    final_calories: calories,
    final_protein_g: protein,
  });
  return { duplicate: found != null };
}

export type CreateMealActionResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" };

export async function createMealAction(
  formData: FormData,
): Promise<CreateMealActionResult> {
  const { date, title, description, calories, protein } =
    parseCreateMealFromFormData(formData);
  const force = String(formData.get("force_duplicate") ?? "") === "1";

  if (!force) {
    const dup = await findRecentPossibleDuplicateMeal({
      date,
      title: title || undefined,
      description: description || undefined,
      final_calories: calories,
      final_protein_g: protein,
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
    final_protein_g: protein ?? undefined,
  });

  revalidatePath("/today");
  revalidatePath("/history");
  return { ok: true };
}

export async function updateMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = parseRequiredCalories(formData.get("final_calories"));
  const protein = parseNumber(formData.get("final_protein_g"));

  await updateMeal({
    id,
    title: title ? title : null,
    description: description ? description : null,
    final_calories: calories,
    final_protein_g: protein,
  });

  revalidatePath("/today");
  revalidatePath("/history");
}

export async function softDeleteMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await softDeleteMeal(id);
  revalidatePath("/today");
  revalidatePath("/history");
}

