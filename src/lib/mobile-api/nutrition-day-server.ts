import "server-only";

import { measurePerformance, type RequestPerformanceContext } from "@/lib/request-performance";
import { buildMobileNutritionDayResponse, parseNutritionDate } from "./nutrition-day";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";

export async function readMobileNutritionDaySnapshot(
  date: unknown,
  context: MobileSupabaseAuthenticatedContext,
  performance: RequestPerformanceContext,
) {
  const requestedDate = parseNutritionDate(date);
  const snapshot = () => measurePerformance({
    route: "/api/mobile/v1/nutrition/days/[date]", operation: "mobile.nutrition.day.snapshot", layer: "database", ...performance,
  }, () => context.supabase.rpc("mobile_read_nutrition_day", { p_log_date: requestedDate }, { get: true }));
  const { data, error } = await snapshot();
  if (error) throw new Error("Nutrition day snapshot unavailable");
  return buildMobileNutritionDayResponse(requestedDate, data);
}

export async function readMobileNutritionDay(
  date: unknown,
  context: MobileSupabaseAuthenticatedContext,
  performance: RequestPerformanceContext,
) {
  let result = await readMobileNutritionDaySnapshot(date, context, performance);
  // M5.3: system definitions are created once (canonical, idempotent ensure_user_metrics),
  // even if the account never opened Web. Only an empty activity list can mean that.
  if (result.activity.status === "ok" && result.activity.data.metrics.length === 0) {
    const ensured = await context.supabase.rpc("ensure_user_metrics");
    if (!ensured.error) {
      try { result = await readMobileNutritionDaySnapshot(date, context, performance); }
      catch { /* Keep the valid first snapshot if the follow-up read fails. */ }
    }
  }
  if (result.nutrition.status === "unavailable" || result.activity.status === "unavailable") {
    console.warn("[mobile.nutrition.day] partial availability", {
      nutrition: result.nutrition.status, activity: result.activity.status,
    });
  }
  return result;
}
