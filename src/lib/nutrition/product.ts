import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseLocalizedDecimal } from "../localized-decimal";
import type {
  DayLog,
  ExpenditureRulePeriod,
  Food,
  NutritionEvent,
  NutritionGoalPeriod,
  NutritionPrecision,
  WorkSchedulePeriod,
} from "@/lib/phase1/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string) {
  if (!ISO_DATE.test(value)) throw new Error("Fecha inválida. Usá YYYY-MM-DD.");
}

function textValue(value: unknown, label: string, required = true) {
  const parsed = String(value ?? "").trim();
  if (required && !parsed) throw new Error(`${label} es obligatorio.`);
  return parsed || null;
}

export function parseRequiredNumber(
  value: unknown,
  label: string,
  options: { integer?: boolean; min?: number; max?: number } = {},
) {
  const raw = String(value ?? "").trim();
  const unsigned = raw.startsWith("-") ? raw.slice(1) : raw;
  const decimal = parseLocalizedDecimal(unsigned);
  const parsed = raw.startsWith("-") && decimal !== null ? -decimal : decimal;
  if (!raw || parsed === null || !Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido.`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${label} debe ser entero.`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${label} debe ser al menos ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw new Error(`${label} no puede superar ${options.max}.`);
  return parsed;
}

export function parseOptionalNumber(
  value: unknown,
  label: string,
  options: { integer?: boolean; min?: number; max?: number } = {},
) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return parseRequiredNumber(raw, label, options);
}

async function authed() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Autenticación: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function ensureUniqueDate(supabase: SupabaseServerClient, table: string, userId: string, effectiveFrom: string) {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();
  if (error) throw new Error(`Comprobar fecha de vigencia: ${error.message}`);
  if (data) throw new Error("Ya existe una versión para esa fecha. Elegí otra fecha.");
}

export async function updateDailyActivity(input: {
  dayLogId: string;
  steps: unknown;
  waterL: unknown;
  mateL: unknown;
}): Promise<DayLog> {
  const { supabase, userId } = await authed();
  const patch = {
    steps: parseOptionalNumber(input.steps, "Pasos", { integer: true, min: 0, max: 1_000_000 }),
    water_l: parseOptionalNumber(input.waterL, "Agua", { min: 0, max: 50 }),
    mate_l: parseOptionalNumber(input.mateL, "Mate", { min: 0, max: 50 }),
  };
  const { data, error } = await supabase.from("day_logs").update(patch)
    .eq("id", input.dayLogId).eq("user_id", userId).select("*").single();
  if (error) throw new Error(`Guardar actividad diaria: ${error.message}`);
  return data as DayLog;
}

export async function updateWorkOverride(input: {
  dayLogId: string;
  mode: "schedule" | "worked" | "not_worked";
  reason?: string;
}): Promise<void> {
  const { supabase, userId } = await authed();
  const automatic = input.mode === "schedule";
  const reason = automatic ? null : textValue(input.reason, "Motivo");
  const patch = automatic
    ? { work_override: null, work_override_source: null, work_override_reason: null }
    : {
        work_override: input.mode === "worked",
        work_override_source: "manual_web",
        work_override_reason: reason,
      };
  const { error } = await supabase.from("day_logs").update(patch)
    .eq("id", input.dayLogId).eq("user_id", userId);
  if (error) throw new Error(`Guardar corrección laboral: ${error.message}`);
}

export async function updateGymOverride(input: {
  dayLogId: string;
  enabled: boolean;
  reason?: string;
}): Promise<void> {
  const { supabase, userId } = await authed();
  const patch = input.enabled
    ? { gym_override: true, gym_override_source: "manual_web", gym_override_reason: textValue(input.reason, "Motivo") }
    : { gym_override: null, gym_override_source: null, gym_override_reason: null };
  const { error } = await supabase.from("day_logs").update(patch)
    .eq("id", input.dayLogId).eq("user_id", userId);
  if (error) throw new Error(`Guardar corrección de entrenamiento: ${error.message}`);
}

export async function updateExpenditureOverride(input: {
  dayLogId: string;
  kcal: unknown;
}): Promise<void> {
  const { supabase, userId } = await authed();
  const kcal = parseOptionalNumber(input.kcal, "Gasto estimado", { integer: true, min: 1, max: 50_000 });
  const { error } = await supabase.from("day_logs").update({ expenditure_override_kcal: kcal })
    .eq("id", input.dayLogId).eq("user_id", userId);
  if (error) throw new Error(`Guardar gasto excepcional: ${error.message}`);
}

export async function listNutritionEvents(date: string): Promise<NutritionEvent[]> {
  assertDate(date);
  const { supabase, userId } = await authed();
  const { data, error } = await supabase.from("nutrition_events")
    .select("id,user_id,event_date,event_type,intensity,planned,alcohol,drinks_equivalent,event_calories,context,notes,origin,source_type,legacy_import_source,legacy_import_id,import_run_id,created_at,updated_at")
    .eq("user_id", userId).eq("event_date", date).order("created_at");
  if (error) throw new Error(`Leer eventos nutricionales: ${error.message}`);
  return (data ?? []) as NutritionEvent[];
}

export async function listNutritionConfiguration() {
  const { supabase, userId } = await authed();
  const [goals, expenditure, schedules, foods] = await Promise.all([
    supabase.from("nutrition_goal_periods").select("*").eq("user_id", userId).order("effective_from", { ascending: false }),
    supabase.from("expenditure_rule_periods").select("*").eq("user_id", userId).order("effective_from", { ascending: false }),
    supabase.from("work_schedule_periods").select("*").eq("user_id", userId).order("effective_from", { ascending: false }),
    supabase.from("foods").select("id,user_id,name,description,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,precision_level,source_note,is_active,created_at,updated_at").eq("user_id", userId).order("is_active", { ascending: false }).order("name"),
  ]);
  for (const result of [goals, expenditure, schedules, foods]) {
    if (result.error) throw new Error(`Leer configuración nutricional: ${result.error.message}`);
  }
  return {
    goals: (goals.data ?? []) as NutritionGoalPeriod[],
    expenditure: (expenditure.data ?? []) as ExpenditureRulePeriod[],
    schedules: (schedules.data ?? []) as WorkSchedulePeriod[],
    foods: (foods.data ?? []) as Food[],
  };
}

async function listPeriods<T>(table: "nutrition_goal_periods" | "expenditure_rule_periods" | "work_schedule_periods"): Promise<T[]> {
  const { supabase, userId } = await authed();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("effective_from", { ascending: false });
  if (error) throw new Error(`Leer configuración nutricional: ${error.message}`);
  return (data ?? []) as T[];
}

export function listNutritionGoalPeriods() {
  return listPeriods<NutritionGoalPeriod>("nutrition_goal_periods");
}

export function listExpenditureRulePeriods() {
  return listPeriods<ExpenditureRulePeriod>("expenditure_rule_periods");
}

export function listWorkSchedulePeriods() {
  return listPeriods<WorkSchedulePeriod>("work_schedule_periods");
}

export async function listFoods() {
  const { supabase, userId } = await authed();
  const { data, error } = await supabase
    .from("foods")
    .select("id,user_id,name,description,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,precision_level,source_note,is_active,created_at,updated_at")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw new Error(`Leer alimentos: ${error.message}`);
  return (data ?? []) as Food[];
}

/** A compact, request-scoped read for the nutrition settings hub. */
export async function getNutritionConfigurationHub(today: string): Promise<{
  goal: NutritionGoalPeriod | null;
  expenditure: ExpenditureRulePeriod | null;
  schedule: WorkSchedulePeriod | null;
  activeFoodCount: number;
}> {
  assertDate(today);
  const { supabase, userId } = await authed();
  const [goal, expenditure, schedule, foods] = await Promise.all([
    supabase.from("nutrition_goal_periods").select("*").eq("user_id", userId).lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("expenditure_rule_periods").select("*").eq("user_id", userId).lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("work_schedule_periods").select("*").eq("user_id", userId).lte("effective_from", today).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("foods").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
  ]);
  for (const result of [goal, expenditure, schedule, foods]) {
    if (result.error) throw new Error(`Leer configuración nutricional: ${result.error.message}`);
  }
  return {
    goal: (goal.data ?? null) as NutritionGoalPeriod | null,
    expenditure: (expenditure.data ?? null) as ExpenditureRulePeriod | null,
    schedule: (schedule.data ?? null) as WorkSchedulePeriod | null,
    activeFoodCount: foods.count ?? 0,
  };
}

export async function createNutritionGoalPeriod(formData: FormData) {
  const { supabase, userId } = await authed();
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  assertDate(effectiveFrom);
  await ensureUniqueDate(supabase, "nutrition_goal_periods", userId, effectiveFrom);
  const { error } = await supabase.from("nutrition_goal_periods").insert({
    user_id: userId,
    effective_from: effectiveFrom,
    name: textValue(formData.get("name"), "Nombre"),
    calories_no_gym: parseRequiredNumber(formData.get("calories_no_gym"), "Calorías sin gym", { integer: true, min: 1, max: 20_000 }),
    calories_gym: parseRequiredNumber(formData.get("calories_gym"), "Calorías con gym", { integer: true, min: 1, max: 20_000 }),
    protein_no_gym_g: parseRequiredNumber(formData.get("protein_no_gym_g"), "Proteína sin gym", { min: 0, max: 2_000 }),
    protein_gym_g: parseRequiredNumber(formData.get("protein_gym_g"), "Proteína con gym", { min: 0, max: 2_000 }),
    water_no_gym_l: parseRequiredNumber(formData.get("water_no_gym_l"), "Agua sin gym", { min: 0, max: 50 }),
    water_gym_l: parseRequiredNumber(formData.get("water_gym_l"), "Agua con gym", { min: 0, max: 50 }),
  });
  if (error) throw new Error(`Crear objetivo nutricional: ${error.message}`);
}

export async function createExpenditurePeriod(formData: FormData) {
  const { supabase, userId } = await authed();
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  assertDate(effectiveFrom);
  await ensureUniqueDate(supabase, "expenditure_rule_periods", userId, effectiveFrom);
  const read = (name: string, label: string) => parseRequiredNumber(formData.get(name), label, { integer: true, min: 1, max: 50_000 });
  const { error } = await supabase.from("expenditure_rule_periods").insert({
    user_id: userId, effective_from: effectiveFrom, name: textValue(formData.get("name"), "Nombre"),
    work_gym_kcal: read("work_gym_kcal", "Trabajo + gym"),
    work_no_gym_kcal: read("work_no_gym_kcal", "Trabajo + sin gym"),
    no_work_gym_kcal: read("no_work_gym_kcal", "Sin trabajo + gym"),
    no_work_no_gym_kcal: read("no_work_no_gym_kcal", "Sin trabajo + sin gym"),
  });
  if (error) throw new Error(`Crear regla de gasto: ${error.message}`);
}

export async function createWorkSchedulePeriod(formData: FormData) {
  const { supabase, userId } = await authed();
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  assertDate(effectiveFrom);
  await ensureUniqueDate(supabase, "work_schedule_periods", userId, effectiveFrom);
  const checked = (name: string) => formData.get(name) === "on";
  const { error } = await supabase.from("work_schedule_periods").insert({
    user_id: userId, effective_from: effectiveFrom, name: textValue(formData.get("name"), "Nombre"),
    monday: checked("monday"), tuesday: checked("tuesday"), wednesday: checked("wednesday"),
    thursday: checked("thursday"), friday: checked("friday"), saturday: checked("saturday"), sunday: checked("sunday"),
  });
  if (error) throw new Error(`Crear horario laboral: ${error.message}`);
}

export type FoodMutationInput = {
  id?: string;
  name: string;
  description?: string;
  servingQuantity: unknown;
  servingUnit: string;
  calories: unknown;
  proteinG: unknown;
  carbsG: unknown;
  fatG: unknown;
  sourceNote?: string;
  precisionLevel?: NutritionPrecision | "";
};

export function parseFoodInput(input: FoodMutationInput) {
  const nutrition = {
    calories: parseOptionalNumber(input.calories, "Calorías", { integer: true, min: 0 }),
    protein_g: parseOptionalNumber(input.proteinG, "Proteína", { min: 0 }),
    carbs_g: parseOptionalNumber(input.carbsG, "Carbohidratos", { min: 0 }),
    fat_g: parseOptionalNumber(input.fatG, "Grasas", { min: 0 }),
  };
  if (Object.values(nutrition).every((value) => value === null)) {
    throw new Error("Informá al menos un valor nutricional.");
  }
  return {
    name: textValue(input.name, "Nombre"),
    description: textValue(input.description, "Descripción", false),
    serving_quantity: parseRequiredNumber(input.servingQuantity, "Porción", { min: 0.001, max: 1_000_000 }),
    serving_unit: textValue(input.servingUnit, "Unidad"),
    ...nutrition,
    precision_level: input.precisionLevel || null,
    source_note: textValue(input.sourceNote, "Fuente", false),
  };
}

export async function saveFood(input: FoodMutationInput): Promise<Food> {
  const { supabase, userId } = await authed();
  const payload = parseFoodInput(input);
  const query = input.id
    ? supabase.from("foods").update(payload).eq("id", input.id).eq("user_id", userId)
    : supabase.from("foods").insert({ ...payload, user_id: userId, is_active: true });
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(`Guardar alimento: ${error.message}`);
  return data as Food;
}

export async function setFoodActive(id: string, isActive: boolean): Promise<Food> {
  const { supabase, userId } = await authed();
  const { data, error } = await supabase.from("foods").update({ is_active: isActive })
    .eq("id", id).eq("user_id", userId).select("*").single();
  if (error) throw new Error(`${isActive ? "Reactivar" : "Desactivar"} alimento: ${error.message}`);
  return data as Food;
}
