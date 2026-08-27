import "server-only";

import { type AuthenticatedRequestContext, createClient } from "@/lib/supabase/server";
import { resolveNutritionReportRange } from "./reports-core";
import {
  aggregateStepsReport,
  buildStepsReportDays,
  lastSevenCompletedStepsRange,
  type StepsDayLogFact,
} from "./steps-report-core";

async function getAuthedContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

async function loadSteps(input: { start: string; end: string }, today: string, context?: AuthenticatedRequestContext) {
  const { supabase, userId } = context ?? await getAuthedContext();
  const { data, error } = await supabase
    .from("day_logs")
    .select("log_date, steps")
    .eq("user_id", userId)
    .gte("log_date", input.start)
    .lte("log_date", input.end)
    .order("log_date", { ascending: false });
  if (error) throw new Error(`Leer pasos para reportes: ${error.message}`);
  return buildStepsReportDays({ range: input, today, dayLogs: (data ?? []) as StepsDayLogFact[] });
}

export async function getStepsReport(
  input: { period?: string; from?: string; to?: string },
  today: string,
  context?: AuthenticatedRequestContext,
) {
  const range = resolveNutritionReportRange(input, today);
  const days = await loadSteps(range, today, context);
  return { range, days, summary: aggregateStepsReport(days) };
}

export async function getStepsOverview(today: string, context?: AuthenticatedRequestContext) {
  const range = lastSevenCompletedStepsRange(today);
  const days = await loadSteps(range, today, context);
  return { range, days, summary: aggregateStepsReport(days) };
}
