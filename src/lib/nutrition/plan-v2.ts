import "server-only";

import type {
  EnergyConfigPeriod,
  ExpenditureRulePeriod,
  NutritionGoalPeriod,
  NutritionPlanPeriod,
  NutritionPlanWeekday,
} from "@/lib/phase1/types";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { parseRequiredNumber } from "./product";
import {
  ACTIVITY_FACTORS,
  WEEKDAYS,
} from "./plan-v2-core";

export type { NutritionPlanEditor, EnergyConfigEditor } from './configuration-core';
import { planEditor, energyEditor, type NutritionPlanEditor, type EnergyConfigEditor } from './configuration-core';
type PlanWithWeekdays = NutritionPlanPeriod & { nutrition_plan_weekdays: NutritionPlanWeekday[] };
function assertDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida.'); }

export async function getNutritionPlanEditor(date: string): Promise<NutritionPlanEditor> {
  assertDate(date);
  const { supabase, userId } = await requireAuthenticatedRequestContext();
  const [planResult, goalResult] = await Promise.all([
    supabase
      .from("nutrition_plan_periods")
      .select("*,nutrition_plan_weekdays(*)")
      .eq("user_id", userId)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_goal_periods")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (planResult.error) throw new Error(`Leer plan nutricional: ${planResult.error.message}`);
  if (goalResult.error) throw new Error(`Leer objetivo anterior: ${goalResult.error.message}`);

  const plan = planResult.data as PlanWithWeekdays | null;
  return planEditor(plan, goalResult.data as NutritionGoalPeriod | null);
}

export async function getEnergyConfigEditor(date: string): Promise<EnergyConfigEditor> {
  assertDate(date);
  const { supabase, userId } = await requireAuthenticatedRequestContext();
  const [configResult, legacyResult] = await Promise.all([
    supabase
      .from("energy_config_periods")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("expenditure_rule_periods")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (configResult.error) throw new Error(`Leer cálculo energético: ${configResult.error.message}`);
  if (legacyResult.error) throw new Error(`Leer gasto anterior: ${legacyResult.error.message}`);
  const config = configResult.data as EnergyConfigPeriod | null;
  return energyEditor(config, legacyResult.data as ExpenditureRulePeriod | null);
}

export async function saveNutritionPlanV2(input: {
  name: string;
  baseWaterL: unknown;
  trainingCalorieDeltaKcal: unknown;
  trainingWaterDeltaL: unknown;
  weekdays: Array<{ weekday: number; calorieTargetKcal: unknown; proteinTargetG: unknown }>;
}) {
  if (input.weekdays.length !== 7 || new Set(input.weekdays.map((day) => day.weekday)).size !== 7) {
    throw new Error("La semana debe incluir los siete días.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("El nombre del plan es obligatorio.");
  const weekdays = input.weekdays.map((day) => {
    if (!WEEKDAYS.some((item) => item.value === day.weekday)) throw new Error("Día inválido.");
    return {
      weekday: day.weekday,
      calorie_target_kcal: parseRequiredNumber(day.calorieTargetKcal, "Calorías", { integer: true, min: 1, max: 20_000 }),
      protein_target_g: parseRequiredNumber(day.proteinTargetG, "Proteína", { min: 0, max: 2_000 }),
    };
  });
  const { supabase } = await requireAuthenticatedRequestContext();
  const { data, error } = await supabase.rpc("save_nutrition_plan_v2", {
    p_name: name,
    p_base_water_l: parseRequiredNumber(input.baseWaterL, "Agua base", { min: 0, max: 50 }),
    p_training_calorie_delta_kcal: parseRequiredNumber(input.trainingCalorieDeltaKcal, "Extra de calorías", { integer: true, min: 0, max: 5_000 }),
    p_training_water_delta_l: parseRequiredNumber(input.trainingWaterDeltaL, "Extra de agua", { min: 0, max: 20 }),
    p_weekdays: weekdays,
  });
  if (error) throw new Error(`Guardar plan nutricional: ${error.message}`);
  return data as string;
}

export async function saveEnergyConfigV2(input: {
  activityLevel: string;
  baseExpenditureMode: string;
  customBaseExpenditureKcal: unknown;
  trainingExpenditureDeltaKcal: unknown;
}) {
  if (!(input.activityLevel in ACTIVITY_FACTORS)) throw new Error("Actividad cotidiana inválida.");
  if (input.baseExpenditureMode !== "automatic" && input.baseExpenditureMode !== "custom") {
    throw new Error("Modo de gasto base inválido.");
  }
  const customBaseExpenditureKcal = input.baseExpenditureMode === "custom"
    ? parseRequiredNumber(input.customBaseExpenditureKcal, "Gasto base personalizado", { integer: true, min: 1, max: 20_000 })
    : null;
  const { supabase } = await requireAuthenticatedRequestContext();
  const { data, error } = await supabase.rpc("save_energy_config_v2", {
    p_activity_level: input.activityLevel,
    p_base_expenditure_mode: input.baseExpenditureMode,
    p_custom_base_expenditure_kcal: customBaseExpenditureKcal,
    p_training_expenditure_delta_kcal: parseRequiredNumber(
      input.trainingExpenditureDeltaKcal,
      "Ajuste por entrenamiento",
      { integer: true, min: 0, max: 5_000 },
    ),
  });
  if (error) throw new Error(`Guardar cálculo energético: ${error.message}`);
  return data as string;
}
