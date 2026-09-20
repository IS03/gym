import "server-only";

import {
  getNutritionDaySummaryForLog,
  listActiveMealsForDayLog,
} from "@/lib/nutrition/day";
import {
  createMeal,
  getOrCreateDayLog,
  MealNotFoundError,
  softDeleteMeal,
  updateMeal,
} from "@/lib/phase1/day-log";
import {
  measurePerformance,
  type RequestPerformanceContext,
} from "@/lib/request-performance";
import { resilientRead } from "@/lib/resilient-read";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { MobileApiNotFoundError } from "./auth";
import type {
  MobileMealDeleteResponse,
  MobileMealMutationResponse,
  MobileNutritionTodayResponse,
} from "./contracts";
import {
  buildMobileNutritionTodayResponse,
  mobileMealDto,
  parseMobileMealId,
  parseMobileMealMutation,
} from "./nutrition";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";

function authenticatedContext(
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
): AuthenticatedRequestContext {
  return {
    supabase: context.supabase,
    userId: context.userId,
    requestPerformance,
  };
}

function notFound(error: unknown): never {
  if (error instanceof MealNotFoundError) {
    throw new MobileApiNotFoundError("La comida ya no está disponible.");
  }
  throw error;
}

export async function readMobileNutritionToday(
  date: string,
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
): Promise<MobileNutritionTodayResponse> {
  const auth = authenticatedContext(context, requestPerformance);
  const performanceBase = {
    route: "/api/mobile/v1/nutrition/today",
    layer: "database" as const,
    ...requestPerformance,
  };
  const dayLog = await measurePerformance(
    { ...performanceBase, operation: "mobile.nutrition.day-log" },
    () => getOrCreateDayLog(date, auth),
  );
  const [summary, meals] = await Promise.all([
    resilientRead(
      { ...performanceBase, operation: "mobile.nutrition.summary" },
      () => getNutritionDaySummaryForLog(date, dayLog, auth),
    ),
    resilientRead(
      { ...performanceBase, operation: "mobile.nutrition.meals" },
      () => listActiveMealsForDayLog(dayLog.id, auth),
    ),
  ]);

  return buildMobileNutritionTodayResponse(date, { summary, meals });
}

export async function createMobileMeal(
  date: string,
  payload: unknown,
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
): Promise<MobileMealMutationResponse> {
  const input = parseMobileMealMutation(payload, {
    requireIdempotencyKey: true,
  });
  const meal = await createMeal(
    {
      date,
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      final_calories: input.calories,
      final_protein_g: input.proteinG,
      final_carbs_g: input.carbsG,
      final_fat_g: input.fatG,
      idempotencyKey: input.idempotencyKey,
    },
    authenticatedContext(context, requestPerformance),
  );
  return { meal: mobileMealDto(meal) };
}

export async function updateMobileMeal(
  id: unknown,
  date: string,
  payload: unknown,
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
): Promise<MobileMealMutationResponse> {
  const mealId = parseMobileMealId(id);
  const input = parseMobileMealMutation(payload, {
    requireIdempotencyKey: false,
  });
  try {
    const meal = await updateMeal(
      {
        id: mealId,
        date,
        title: input.title,
        description: input.description,
        final_calories: input.calories,
        final_protein_g: input.proteinG,
        final_carbs_g: input.carbsG,
        final_fat_g: input.fatG,
      },
      authenticatedContext(context, requestPerformance),
    );
    return { meal: mobileMealDto(meal) };
  } catch (error) {
    notFound(error);
  }
}

export async function deleteMobileMeal(
  id: unknown,
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
): Promise<MobileMealDeleteResponse> {
  const mealId = parseMobileMealId(id);
  try {
    await softDeleteMeal(
      mealId,
      authenticatedContext(context, requestPerformance),
    );
    return { deleted: true };
  } catch (error) {
    notFound(error);
  }
}
