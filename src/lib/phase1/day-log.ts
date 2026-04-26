import { createClient } from "@/lib/supabase/server";
import type { DayLog, MealEntry } from "./types";

export type IsoDate = `${number}-${number}-${number}`; // YYYY-MM-DD

function assertIsoDate(date: string): asserts date is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Fecha inválida. Usá YYYY-MM-DD.");
  }
}

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return user.id;
}

export async function getOrCreateDayLog(date: string): Promise<DayLog> {
  assertIsoDate(date);
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase.rpc("get_or_create_day_log", {
    p_user_id: userId,
    p_log_date: date,
  });

  if (error) {
    throw new Error(`RPC get_or_create_day_log: ${error.message}`);
  }

  return data as DayLog;
}

export async function getDayLogWithMeals(date: string): Promise<{
  dayLog: DayLog;
  meals: MealEntry[];
}> {
  const dayLog = await getOrCreateDayLog(date);
  const supabase = await createClient();

  const { data: meals, error } = await supabase
    .from("meal_entries")
    .select("*")
    .eq("day_log_id", dayLog.id)
    .is("deleted_at", null)
    .order("consumed_at", { ascending: false });

  if (error) throw new Error(`Leer meal_entries: ${error.message}`);

  return { dayLog, meals: (meals ?? []) as MealEntry[] };
}

export type CreateMealInput = {
  date: string;
  consumed_at?: string;
  title?: string;
  description?: string;
  final_calories?: number;
  final_protein_g?: number;
};

export async function createMeal(input: CreateMealInput): Promise<MealEntry> {
  assertIsoDate(input.date);
  if (typeof input.final_calories !== "number" || input.final_calories <= 0) {
    throw new Error("Las calorías son obligatorias y deben ser mayores a 0.");
  }
  const dayLog = await getOrCreateDayLog(input.date);
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("meal_entries")
    .insert({
      user_id: userId,
      day_log_id: dayLog.id,
      consumed_at: input.consumed_at ?? new Date().toISOString(),
      title: input.title ?? null,
      description: input.description ?? null,
      final_calories: Math.trunc(input.final_calories),
      final_protein_g:
        typeof input.final_protein_g === "number" ? input.final_protein_g : null,
      source_type: "manual",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Crear meal_entries: ${error.message}`);
  return data as MealEntry;
}

export type UpdateMealInput = {
  id: string;
  title?: string | null;
  description?: string | null;
  final_calories?: number | null;
  final_protein_g?: number | null;
};

export async function updateMeal(input: UpdateMealInput): Promise<MealEntry> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.final_calories !== undefined) {
    if (input.final_calories === null || input.final_calories <= 0) {
      throw new Error("Las calorías son obligatorias y deben ser mayores a 0.");
    }
    patch.final_calories = Math.trunc(input.final_calories);
  }
  if (input.final_protein_g !== undefined)
    patch.final_protein_g = input.final_protein_g;

  const { data, error } = await supabase
    .from("meal_entries")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`Editar meal_entries: ${error.message}`);
  return data as MealEntry;
}

export async function softDeleteMeal(id: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { error } = await supabase
    .from("meal_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Soft delete meal_entries: ${error.message}`);
}

export async function listRecentDays(limit = 14): Promise<DayLog[]> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("day_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Leer day_logs: ${error.message}`);
  return (data ?? []) as DayLog[];
}

