"use server";

import { revalidatePath } from "next/cache";
import {
  updateDailyActivity,
  updateExpenditureOverride,
  updateGymOverride,
  updateWorkOverride,
} from "@/lib/nutrition/product";

type Result = { ok: true } | { ok: false; error: string };

function message(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar el cambio.";
}

function refreshNutritionPages() {
  revalidatePath("/today");
  revalidatePath("/home");
  revalidatePath("/history");
  revalidatePath("/today/reports");
}

export async function saveDailyActivityAction(input: {
  dayLogId: string; steps: string; waterL: string; mateL: string;
}): Promise<Result> {
  try {
    await updateDailyActivity(input);
    refreshNutritionPages();
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function saveWorkOverrideAction(input: {
  dayLogId: string; mode: "schedule" | "worked" | "not_worked"; reason?: string;
}): Promise<Result> {
  try {
    await updateWorkOverride(input);
    refreshNutritionPages();
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function saveGymOverrideAction(input: {
  dayLogId: string; enabled: boolean; reason?: string;
}): Promise<Result> {
  try {
    await updateGymOverride(input);
    refreshNutritionPages();
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}

export async function saveExpenditureOverrideAction(input: {
  dayLogId: string; kcal: string;
}): Promise<Result> {
  try {
    await updateExpenditureOverride(input);
    refreshNutritionPages();
    return { ok: true };
  } catch (error) { return { ok: false, error: message(error) }; }
}
