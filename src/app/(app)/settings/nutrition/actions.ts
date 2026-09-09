"use server";

import { revalidatePath } from "next/cache";
import {
  createExpenditurePeriod,
  createNutritionGoalPeriod,
  createWorkSchedulePeriod,
  deleteFood,
  FoodProductError,
  saveFood,
  setFoodActive,
  type FoodMutationInput,
} from "@/lib/nutrition/product";
import {
  ActiveIntegrationTokenError,
  createIntegrationApiToken,
  revokeIntegrationApiToken,
} from "@/lib/integrations/chatgpt-tokens";
import {
  deleteSavedMeal,
  SavedMealProductError,
  saveSavedMeal,
  setSavedMealActive,
  type SavedMealMutationInput,
} from "@/lib/nutrition/saved-meals";
import {
  saveEnergyConfigV2,
  saveNutritionPlanV2,
} from "@/lib/nutrition/plan-v2";

export type SettingsActionState = { ok: boolean; error?: string };

function refresh() {
  for (const path of ["/settings", "/settings/nutrition", "/settings/nutrition/energy", "/settings/nutrition/goals", "/settings/nutrition/expenditure", "/settings/nutrition/schedule", "/settings/nutrition/foods", "/settings/nutrition/meals", "/settings/nutrition/integrations", "/today", "/today/reports", "/home", "/history"]) {
    revalidatePath(path);
  }
}

export async function saveNutritionPlanV2Action(input: Parameters<typeof saveNutritionPlanV2>[0]) {
  return run(() => saveNutritionPlanV2(input));
}

export async function saveEnergyConfigV2Action(input: Parameters<typeof saveEnergyConfigV2>[0]) {
  return run(() => saveEnergyConfigV2(input));
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
  try {
    const food = await saveFood(input);
    refresh();
    return { ok: true as const, food };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof FoodProductError
        ? error.message
        : "No pudimos guardar el alimento.",
      field: error instanceof FoodProductError ? error.field : undefined,
    };
  }
}

export async function setFoodActiveAction(input: { id: string; active: boolean }) {
  try {
    const food = await setFoodActive(input.id, input.active);
    refresh();
    return { ok: true as const, food };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof FoodProductError
        ? error.message
        : "No pudimos actualizar el alimento.",
    };
  }
}

export async function deleteFoodAction(input: { id: string }) {
  try {
    await deleteFood(input.id);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof FoodProductError
        ? error.message
        : "No pudimos eliminar el alimento.",
    };
  }
}

export async function saveSavedMealAction(input: SavedMealMutationInput) {
  try {
    const meal = await saveSavedMeal(input);
    refresh();
    return { ok: true as const, meal };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos guardar la comida habitual.",
    };
  }
}

export async function setSavedMealActiveAction(input: { id: string; active: boolean }) {
  try {
    const meal = await setSavedMealActive(input.id, input.active);
    refresh();
    return { ok: true as const, meal };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos actualizar la comida habitual.",
    };
  }
}

export async function deleteSavedMealAction(input: { id: string }) {
  try {
    await deleteSavedMeal(input.id);
    refresh();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof SavedMealProductError
        ? error.message
        : "No pudimos eliminar la comida habitual.",
    };
  }
}

export async function createChatgptKeyAction() {
  try {
    const result = await createIntegrationApiToken();
    revalidatePath("/settings/nutrition");
    revalidatePath("/settings/nutrition/integrations");
    return { ok: true as const, ...result };
  } catch (error) {
    console.warn("[integration-token] create_failed");
    return {
      ok: false as const,
      error:
        error instanceof ActiveIntegrationTokenError
          ? error.message
          : "No se pudo crear la clave.",
    };
  }
}

export async function revokeChatgptKeyAction(id: string) {
  try {
    await revokeIntegrationApiToken(id);
    refresh();
    return { ok: true };
  } catch {
    console.warn("[integration-token] revoke_failed");
    return { ok: false, error: "No se pudo revocar la clave." };
  }
}
