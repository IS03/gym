import "server-only";

import { createClient, type AuthenticatedRequestContext } from "@/lib/supabase/server";
import {
  aggregateNutritionReport,
  buildNutritionReportComparison,
  buildNutritionReportDays,
  previousNutritionReportRange,
  resolveNutritionReportRange,
  type NutritionReportDateRange,
  type NutritionReportDayLogFact,
  type NutritionReportMealFact,
  type NutritionReportWorkoutFact,
} from "./reports-core";

async function getAuthedContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

async function readNutritionReportFacts(
  range: NutritionReportDateRange,
  context?: AuthenticatedRequestContext,
) {
  const { supabase, userId } = context ?? await getAuthedContext();
  const { data: rawDays, error: daysError } = await supabase
    .from("day_logs")
    .select(`
      id, log_date,
      total_calories_consumed, total_protein_g, total_carbs_g, total_fat_g,
      nutrition_target_kcal_snapshot, protein_target_g_snapshot, water_target_l_snapshot,
      estimated_expenditure_kcal_snapshot, delta_vs_nutrition_target, energy_balance_kcal,
      water_l, mate_l, steps,
      work_effective_snapshot, gym_effective_snapshot, gym_source_snapshot,
      nutrition_goal_period_id, nutrition_plan_period_id, goal_type_snapshot
    `)
    .eq("user_id", userId)
    .gte("log_date", range.start)
    .lte("log_date", range.end)
    .order("log_date", { ascending: false });

  if (daysError) throw new Error(`Leer días para reportes: ${daysError.message}`);
  const dayLogs = (rawDays ?? []) as NutritionReportDayLogFact[];
  const ids = dayLogs.map((day) => day.id);
  let meals: NutritionReportMealFact[] = [];
  let workouts: NutritionReportWorkoutFact[] = [];
  const goalNames = new Map<string, string>();

  if (ids.length > 0) {
    const nutritionPlanIds = [...new Set(dayLogs.map((day) => day.nutrition_plan_period_id).filter((id): id is string => id !== null))];
    const legacyGoalIds = [...new Set(dayLogs.map((day) => day.nutrition_goal_period_id).filter((id): id is string => id !== null))];
    const [mealResult, workoutResult, planResult, legacyGoalResult] = await Promise.all([
      supabase
        .from("meal_entries")
        .select("day_log_id, entry_kind, final_calories, final_protein_g, final_carbs_g, final_fat_g, source_type, deleted_at")
        .eq("user_id", userId)
        .in("day_log_id", ids)
        .is("deleted_at", null),
      supabase
        .from("workout_sessions")
        .select("day_log_id, status")
        .eq("user_id", userId)
        .in("day_log_id", ids)
        .eq("status", "completed"),
      nutritionPlanIds.length
        ? supabase.from("nutrition_plan_periods").select("id,name").eq("user_id", userId).in("id", nutritionPlanIds)
        : Promise.resolve({ data: [], error: null }),
      legacyGoalIds.length
        ? supabase.from("nutrition_goal_periods").select("id,name").eq("user_id", userId).in("id", legacyGoalIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (mealResult.error) throw new Error(`Leer comidas para reportes: ${mealResult.error.message}`);
    if (workoutResult.error) throw new Error(`Leer entrenamientos para reportes: ${workoutResult.error.message}`);
    if (planResult.error) throw new Error(`Leer etapas nutricionales: ${planResult.error.message}`);
    if (legacyGoalResult.error) throw new Error(`Leer etapas nutricionales anteriores: ${legacyGoalResult.error.message}`);
    meals = (mealResult.data ?? []) as NutritionReportMealFact[];
    workouts = (workoutResult.data ?? []) as NutritionReportWorkoutFact[];
    for (const row of [...(planResult.data ?? []), ...(legacyGoalResult.data ?? [])]) {
      goalNames.set(String(row.id), String(row.name));
    }
  }

  return { dayLogs, meals, workouts, goalNames };
}

export async function getNutritionReport(
  input: { period?: string; from?: string; to?: string },
  today: string,
  context?: AuthenticatedRequestContext,
) {
  const range = resolveNutritionReportRange(input, today);
  const { dayLogs, meals, workouts } = await readNutritionReportFacts(range, context);

  const days = buildNutritionReportDays({ range, today, dayLogs, meals, workouts });
  return { range, days, summary: aggregateNutritionReport(days) };
}

export async function getNutritionReportWithPrevious(
  input: { period?: string; from?: string; to?: string },
  today: string,
  context?: AuthenticatedRequestContext,
) {
  const range = resolveNutritionReportRange(input, today);
  const previousRange = previousNutritionReportRange(range);
  const combinedRange = { start: previousRange.start, end: range.end };
  const facts = await readNutritionReportFacts(combinedRange, context);
  const currentDays = buildNutritionReportDays({ range, today, ...facts });
  const previousDays = buildNutritionReportDays({ range: previousRange, today, ...facts });

  return {
    range,
    days: currentDays,
    summary: aggregateNutritionReport(currentDays),
    comparison: buildNutritionReportComparison({
      currentRange: range,
      previousRange,
      currentDays,
      previousDays,
    }),
  };
}
