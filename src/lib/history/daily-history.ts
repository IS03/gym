import "server-only";

import type { BodyMeasurement } from "@/lib/body-measurements";
import type { DayLog, NutritionEvent } from "@/lib/phase1/types";
import { getNutritionDay } from "@/lib/nutrition/day";
import type { NutritionDayReadModel } from "@/lib/nutrition/types";
import type { WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "@/lib/phase2/types";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { addIsoDays } from "@/lib/nutrition/reports-core";
import { summarizeDailyHistorySessions, type DailyHistorySession } from "./daily-history-core";

type SessionWithDate = WorkoutSession & { day_log: { log_date: string } | Array<{ log_date: string }> | null };

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export type DailyHistoryListItem = {
  date: string;
  dayLog: Pick<DayLog, "id" | "log_date" | "total_calories_consumed" | "total_protein_g" | "steps" | "weight_kg"> & { targetKcal: number | null } | null;
  workoutNames: string[];
  measurement: BodyMeasurement | null;
};

export async function listDailyHistoryDays(input: {
  today: string;
  context: AuthenticatedRequestContext;
  limit?: number;
}): Promise<DailyHistoryListItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 366);
  const start = addIsoDays(input.today, -(limit - 1));
  const { supabase, userId } = input.context;
  const [dayResult, sessionResult, bodyResult] = await Promise.all([
    supabase.from("day_logs")
      .select("id,log_date,total_calories_consumed,nutrition_target_kcal_snapshot,total_protein_g,steps,weight_kg")
      .eq("user_id", userId).gte("log_date", start).lte("log_date", input.today),
    supabase.from("workout_sessions")
      .select("id,routine_name_snapshot,session_name,day_log:day_logs!inner(log_date)")
      .eq("user_id", userId).eq("status", "completed")
      .gte("day_logs.log_date", start).lte("day_logs.log_date", input.today),
    supabase.from("body_measurements")
      .select("*").eq("user_id", userId).gte("measured_on", start).lte("measured_on", input.today),
  ]);
  if (dayResult.error) throw new Error(`Leer días de historial: ${dayResult.error.message}`);
  if (sessionResult.error) throw new Error(`Leer entrenamientos de historial: ${sessionResult.error.message}`);
  if (bodyResult.error) throw new Error(`Leer medidas de historial: ${bodyResult.error.message}`);

  const byDate = new Map<string, DailyHistoryListItem>();
  for (const rawDay of (dayResult.data ?? []) as Array<Pick<DayLog, "id" | "log_date" | "total_calories_consumed" | "nutrition_target_kcal_snapshot" | "total_protein_g" | "steps" | "weight_kg">>) {
    const { nutrition_target_kcal_snapshot: targetKcal, ...day } = rawDay;
    if (!day) continue;
    byDate.set(day.log_date, { date: day.log_date, dayLog: { ...day, targetKcal }, workoutNames: [], measurement: null });
  }
  for (const row of (sessionResult.data ?? []) as Array<{ routine_name_snapshot: string | null; session_name: string | null; day_log: { log_date: string } | Array<{ log_date: string }> | null }>) {
    const date = firstRelation(row.day_log)?.log_date;
    if (!date) continue;
    const item = byDate.get(date) ?? { date, dayLog: null, workoutNames: [], measurement: null };
    const name = row.routine_name_snapshot ?? row.session_name ?? "Sesión libre";
    if (!item.workoutNames.includes(name)) item.workoutNames.push(name);
    byDate.set(date, item);
  }
  for (const measurement of (bodyResult.data ?? []) as BodyMeasurement[]) {
    const item = byDate.get(measurement.measured_on) ?? { date: measurement.measured_on, dayLog: null, workoutNames: [], measurement: null };
    item.measurement = measurement;
    byDate.set(measurement.measured_on, item);
  }
  return [...byDate.values()].sort((left, right) => right.date.localeCompare(left.date));
}

async function listCompletedHistorySessions(date: string, context: AuthenticatedRequestContext): Promise<DailyHistorySession[]> {
  const { supabase, userId } = context;
  const { data: rawSessions, error: sessionsError } = await supabase
    .from("workout_sessions")
    .select("*,day_log:day_logs!inner(log_date)")
    .eq("user_id", userId).eq("status", "completed").eq("day_logs.log_date", date)
    .order("ended_at", { ascending: false });
  if (sessionsError) throw new Error(`Leer sesiones del historial: ${sessionsError.message}`);
  const sessions = (rawSessions ?? []).map((row) => {
    const { day_log, ...session } = row as SessionWithDate;
    void day_log;
    return session as WorkoutSession;
  });
  if (sessions.length === 0) return [];
  const sessionIds = sessions.map((session) => session.id);
  const { data: rawExercises, error: exercisesError } = await supabase
    .from("workout_session_exercises").select("*")
    .eq("user_id", userId).in("workout_session_id", sessionIds);
  if (exercisesError) throw new Error(`Leer ejercicios del historial: ${exercisesError.message}`);
  const exercises = (rawExercises ?? []) as WorkoutSessionExercise[];
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const { data: rawSets, error: setsError } = exerciseIds.length
    ? await supabase.from("workout_sets").select("*").eq("user_id", userId).in("workout_session_exercise_id", exerciseIds)
    : { data: [], error: null };
  if (setsError) throw new Error(`Leer series del historial: ${setsError.message}`);
  return summarizeDailyHistorySessions({ sessions, exercises, sets: (rawSets ?? []) as WorkoutSet[] });
}

export type DailyHistoryDetail = {
  nutrition: NutritionDayReadModel;
  sessions: DailyHistorySession[];
  measurement: BodyMeasurement | null;
  events: NutritionEvent[];
};

export async function getDailyHistoryDetail(date: string, context: AuthenticatedRequestContext): Promise<DailyHistoryDetail> {
  const { supabase, userId } = context;
  const [nutrition, sessions, bodyResult, eventsResult] = await Promise.all([
    getNutritionDay(date, { createIfMissing: false }, context),
    listCompletedHistorySessions(date, context),
    supabase.from("body_measurements").select("*").eq("user_id", userId).eq("measured_on", date).maybeSingle(),
    supabase.from("nutrition_events").select("*").eq("user_id", userId).eq("event_date", date).order("created_at"),
  ]);
  if (bodyResult.error) throw new Error(`Leer medidas del historial: ${bodyResult.error.message}`);
  if (eventsResult.error) throw new Error(`Leer eventos del historial: ${eventsResult.error.message}`);
  return {
    nutrition,
    sessions,
    measurement: (bodyResult.data as BodyMeasurement | null) ?? null,
    events: (eventsResult.data ?? []) as NutritionEvent[],
  };
}
