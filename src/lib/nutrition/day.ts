import "server-only";

import { getOrCreateDayLog } from "@/lib/phase1/day-log";
import type { DayLog, MealEntry } from "@/lib/phase1/types";
import {
  createClient,
  requireAuthenticatedRequestContext,
  type AuthenticatedRequestContext,
} from "@/lib/supabase/server";
import type {
  ExistingNutritionDay,
  NutritionContext,
  NutritionDayReadModel,
  NutritionGymSource,
  NutritionWorkSource,
  ResolvedNutritionContext,
} from "./types";

type ResolveNutritionContextRow = {
  day_log_id: string | null;
  work_effective: boolean | null;
  gym_effective: boolean;
  work_source: NutritionWorkSource;
  gym_source: NutritionGymSource;
  work_schedule_period_id: string | null;
  nutrition_goal_period_id: string | null;
  expenditure_rule_period_id: string | null;
  nutrition_target_kcal: number | null;
  protein_target_g: number | null;
  water_target_l: number | null;
  estimated_expenditure_kcal: number | null;
  total_calories_consumed: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  water_l: number | null;
  mate_l: number | null;
  steps: number | null;
  delta_vs_nutrition_target: number | null;
  energy_balance_kcal: number | null;
};

function assertIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Fecha inválida. Usá YYYY-MM-DD.");
  }
}

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

function contextFromSnapshot(dayLog: DayLog): NutritionContext {
  return {
    work: {
      effective: dayLog.work_effective_snapshot,
      source: dayLog.work_source_snapshot as NutritionWorkSource,
    },
    gym: {
      effective: dayLog.gym_effective_snapshot ?? false,
      source: (dayLog.gym_source_snapshot ?? "none") as NutritionGymSource,
    },
    periodIds: {
      workSchedule: dayLog.work_schedule_period_id,
      nutritionGoal: dayLog.nutrition_goal_period_id,
      expenditureRule: dayLog.expenditure_rule_period_id,
    },
    targets: {
      calories: dayLog.nutrition_target_kcal_snapshot,
      proteinG: dayLog.protein_target_g_snapshot,
      waterL: dayLog.water_target_l_snapshot,
    },
    expenditureKcal: dayLog.estimated_expenditure_kcal_snapshot,
    consumption: {
      calories: dayLog.total_calories_consumed,
      proteinG: dayLog.total_protein_g,
      carbsG: dayLog.total_carbs_g,
      fatG: dayLog.total_fat_g,
      waterL: dayLog.water_l,
      mateL: dayLog.mate_l,
      steps: dayLog.steps,
    },
    metrics: {
      deltaVsNutritionTarget: dayLog.delta_vs_nutrition_target,
      energyBalanceKcal: dayLog.energy_balance_kcal,
    },
    resolvedAt: dayLog.nutrition_resolved_at,
  };
}

async function listActiveMeals(
  dayLogId: string,
  context: AuthenticatedRequestContext,
): Promise<MealEntry[]> {
  const { supabase } = context;
  const { data, error } = await supabase
    .from("meal_entries")
    .select("*")
    .eq("day_log_id", dayLogId)
    .is("deleted_at", null)
    .order("consumed_at", { ascending: false });

  if (error) throw new Error(`Leer meal_entries: ${error.message}`);
  return (data ?? []) as MealEntry[];
}

export async function getNutritionDay(
  date: string,
  options?: { createIfMissing?: true },
  context?: AuthenticatedRequestContext,
): Promise<ExistingNutritionDay>;
export async function getNutritionDay(
  date: string,
  options: { createIfMissing: false },
  context?: AuthenticatedRequestContext,
): Promise<NutritionDayReadModel>;
export async function getNutritionDay(
  date: string,
  options: { createIfMissing?: boolean } = {},
  context?: AuthenticatedRequestContext,
): Promise<NutritionDayReadModel> {
  assertIsoDate(date);
  const auth = context ?? await requireAuthenticatedRequestContext();
  const createIfMissing = options.createIfMissing ?? true;
  let dayLog: DayLog | null;

  if (createIfMissing) {
    dayLog = await getOrCreateDayLog(date, auth);
  } else {
    const { supabase, userId } = auth;
    const { data, error } = await supabase
      .from("day_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle();

    if (error) throw new Error(`Leer day_logs: ${error.message}`);
    dayLog = (data as DayLog | null) ?? null;
  }

  if (!dayLog) {
    return { date, dayLog: null, meals: [], context: null };
  }

  return {
    date,
    dayLog,
    meals: await listActiveMeals(dayLog.id, auth),
    context: contextFromSnapshot(dayLog),
  };
}

/** Resolución dinámica y read-only para previews o integraciones futuras. */
export async function resolveNutritionContext(
  date: string,
): Promise<ResolvedNutritionContext> {
  assertIsoDate(date);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("resolve_nutrition_context", {
    p_log_date: date,
  });
  if (error) throw new Error(`RPC resolve_nutrition_context: ${error.message}`);

  const row = (data as ResolveNutritionContextRow[] | null)?.[0];
  if (!row) throw new Error("RPC resolve_nutrition_context: respuesta vacía.");

  return {
    dayLogId: row.day_log_id,
    work: { effective: row.work_effective, source: row.work_source },
    gym: { effective: row.gym_effective, source: row.gym_source },
    periodIds: {
      workSchedule: row.work_schedule_period_id,
      nutritionGoal: row.nutrition_goal_period_id,
      expenditureRule: row.expenditure_rule_period_id,
    },
    targets: {
      calories: row.nutrition_target_kcal,
      proteinG: row.protein_target_g,
      waterL: row.water_target_l,
    },
    expenditureKcal: row.estimated_expenditure_kcal,
    consumption: {
      calories: row.total_calories_consumed,
      proteinG: row.total_protein_g,
      carbsG: row.total_carbs_g,
      fatG: row.total_fat_g,
      waterL: row.water_l,
      mateL: row.mate_l,
      steps: row.steps,
    },
    metrics: {
      deltaVsNutritionTarget: row.delta_vs_nutrition_target,
      energyBalanceKcal: row.energy_balance_kcal,
    },
  };
}
