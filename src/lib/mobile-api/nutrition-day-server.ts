import "server-only";

import { measurePerformance, type RequestPerformanceContext } from "@/lib/request-performance";
import { buildMobileNutritionDayResponse, parseNutritionDate } from "./nutrition-day";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";

export async function readMobileNutritionDay(
  date: unknown,
  context: MobileSupabaseAuthenticatedContext,
  performance: RequestPerformanceContext,
) {
  const requestedDate = parseNutritionDate(date);
  const { data, error } = await measurePerformance({
    route: "/api/mobile/v1/nutrition/days/[date]", operation: "mobile.nutrition.day.snapshot", layer: "database", ...performance,
  }, () => context.supabase.rpc("mobile_read_nutrition_day", { p_log_date: requestedDate }, { get: true }));
  if (error) throw new Error("Nutrition day snapshot unavailable");
  const result = buildMobileNutritionDayResponse(requestedDate, data);
  if (result.nutrition.status === "unavailable" || result.activity.status === "unavailable") {
    console.warn("[mobile.nutrition.day] partial availability", {
      nutrition: result.nutrition.status, activity: result.activity.status,
    });
  }
  return result;
}
