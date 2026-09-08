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
  type ActivityLevel,
  type WeekdayNumber,
} from "./plan-v2-core";

export type NutritionPlanEditor = {
  id: string | null;
  effectiveFrom: string | null;
  name: string;
  baseWaterL: number | null;
  trainingCalorieDeltaKcal: number;
  trainingWaterDeltaL: number;
  weekdays: Array<{
    weekday: WeekdayNumber;
    calorieTargetKcal: number | null;
    proteinTargetG: number | null;
  }>;
  source: "v2" | "legacy" | "default";
};

export type EnergyConfigEditor = {
  id: string | null;
  effectiveFrom: string | null;
  activityLevel: ActivityLevel;
  trainingExpenditureDeltaKcal: number;
  source: "v2" | "legacy" | "default";
};

type PlanWithWeekdays = NutritionPlanPeriod & {
  nutrition_plan_weekdays: NutritionPlanWeekday[];
};

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Fecha inválida.");
}

function legacyPlan(goal: NutritionGoalPeriod | null): NutritionPlanEditor {
  const calories = goal?.calories_no_gym ?? null;
  const protein = goal?.protein_no_gym_g ?? null;
  return {
    id: null,
    effectiveFrom: goal?.effective_from ?? null,
    name: goal?.name ?? "Plan nutricional",
    baseWaterL: goal?.water_no_gym_l ?? null,
    trainingCalorieDeltaKcal: goal
      ? Math.max(0, goal.calories_gym - goal.calories_no_gym)
      : 0,
    trainingWaterDeltaL: goal
      ? Math.max(0, goal.water_gym_l - goal.water_no_gym_l)
      : 0,
    weekdays: WEEKDAYS.map(({ value }) => ({
      weekday: value,
      calorieTargetKcal: calories,
      proteinTargetG: protein,
    })),
    source: goal ? "legacy" : "default",
  };
}

function legacyTrainingDelta(rule: ExpenditureRulePeriod | null) {
  if (!rule) return 0;
  const workDelta = rule.work_gym_kcal - rule.work_no_gym_kcal;
  const noWorkDelta = rule.no_work_gym_kcal - rule.no_work_no_gym_kcal;
  return workDelta === noWorkDelta && workDelta >= 0 ? workDelta : 0;
}

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
  if (!plan) return legacyPlan(goalResult.data as NutritionGoalPeriod | null);
  const weekdays = [...plan.nutrition_plan_weekdays]
    .sort((a, b) => a.weekday - b.weekday)
    .map((item) => ({
      weekday: item.weekday as WeekdayNumber,
      calorieTargetKcal: Number(item.calorie_target_kcal),
      proteinTargetG: Number(item.protein_target_g),
    }));
  if (weekdays.length !== 7) throw new Error("El plan vigente está incompleto.");
  return {
    id: plan.id,
    effectiveFrom: plan.effective_from,
    name: plan.name,
    baseWaterL: Number(plan.base_water_l),
    trainingCalorieDeltaKcal: plan.training_calorie_delta_kcal,
    trainingWaterDeltaL: Number(plan.training_water_delta_l),
    weekdays,
    source: "v2",
  };
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
  if (config) {
    return {
      id: config.id,
      effectiveFrom: config.effective_from,
      activityLevel: config.activity_level,
      trainingExpenditureDeltaKcal: config.training_expenditure_delta_kcal,
      source: "v2",
    };
  }
  const legacy = legacyResult.data as ExpenditureRulePeriod | null;
  return {
    id: null,
    effectiveFrom: legacy?.effective_from ?? null,
    activityLevel: "moderate",
    trainingExpenditureDeltaKcal: legacyTrainingDelta(legacy),
    source: legacy ? "legacy" : "default",
  };
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
  trainingExpenditureDeltaKcal: unknown;
}) {
  if (!(input.activityLevel in ACTIVITY_FACTORS)) throw new Error("Actividad cotidiana inválida.");
  const { supabase } = await requireAuthenticatedRequestContext();
  const { data, error } = await supabase.rpc("save_energy_config_v2", {
    p_activity_level: input.activityLevel,
    p_training_expenditure_delta_kcal: parseRequiredNumber(
      input.trainingExpenditureDeltaKcal,
      "Ajuste por entrenamiento",
      { integer: true, min: 0, max: 5_000 },
    ),
  });
  if (error) throw new Error(`Guardar cálculo energético: ${error.message}`);
  return data as string;
}
