"use server";

import { revalidatePath } from "next/cache";
import {
  createExpenditurePeriod,
  createNutritionGoalPeriod,
  createWorkSchedulePeriod,
  saveFood,
  setFoodActive,
  type FoodMutationInput,
} from "@/lib/nutrition/product";
import {
  createIntegrationApiToken,
  revokeIntegrationApiToken,
} from "@/lib/integrations/chatgpt-tokens";

export type SettingsActionState = { ok: boolean; error?: string };

function refresh() {
  for (const path of ["/settings", "/settings/nutrition", "/settings/nutrition/goals", "/settings/nutrition/expenditure", "/settings/nutrition/schedule", "/settings/nutrition/foods", "/settings/nutrition/integrations", "/today", "/home", "/history"]) {
    revalidatePath(path);
  }
}

async function run(task: () => Promise<unknown>): Promise<SettingsActionState> {
  try {
    await task();
    refresh();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}

export async function createGoalAction(_: SettingsActionState, formData: FormData) {
  return run(() => createNutritionGoalPeriod(formData));
}

export async function createExpenditureAction(_: SettingsActionState, formData: FormData) {
  return run(() => createExpenditurePeriod(formData));
}

export async function createScheduleAction(_: SettingsActionState, formData: FormData) {
  return run(() => createWorkSchedulePeriod(formData));
}

export async function saveFoodAction(input: FoodMutationInput) {
  return run(() => saveFood(input));
}

export async function setFoodActiveAction(input: { id: string; active: boolean }) {
  return run(() => setFoodActive(input.id, input.active));
}

export async function createChatgptKeyAction() {
  try {
    const result = await createIntegrationApiToken();
    revalidatePath("/settings/nutrition");
    revalidatePath("/settings/nutrition/integrations");
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "No se pudo crear la clave.",
    };
  }
}

export async function revokeChatgptKeyAction(id: string) {
  return run(async () => {
    await revokeIntegrationApiToken(id);
  });
}
