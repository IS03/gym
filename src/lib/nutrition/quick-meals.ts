import "server-only";

import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import {
  buildQuickMealCandidates,
  quickMealWindow,
  type QuickMealCandidate,
  type QuickMealFact,
} from "./quick-meals-core";

export type { QuickMealCandidate } from "./quick-meals-core";

/** Read model derivado: sólo comidas manuales de los 60 días completos previos. */
export async function getQuickMealCandidates(
  today: string,
  context?: AuthenticatedRequestContext,
): Promise<QuickMealCandidate[]> {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const window = quickMealWindow(today);
  const { data, error } = await auth.supabase
    .from("meal_entries")
    .select("id, title, description, final_calories, final_protein_g, final_carbs_g, final_fat_g, created_at, day_logs!inner(log_date)")
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .eq("entry_kind", "meal")
    .eq("source_type", "manual")
    .gte("day_logs.log_date", window.start)
    .lte("day_logs.log_date", window.end)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Leer comidas rápidas: ${error.message}`);

  const facts: QuickMealFact[] = (data ?? []).flatMap((row) => {
    const dayLog = Array.isArray(row.day_logs) ? row.day_logs[0] : row.day_logs;
    if (!dayLog?.log_date) return [];
    return [{
      id: row.id,
      logDate: dayLog.log_date,
      title: row.title,
      description: row.description,
      finalCalories: row.final_calories,
      finalProteinG: row.final_protein_g,
      finalCarbsG: row.final_carbs_g,
      finalFatG: row.final_fat_g,
      createdAt: row.created_at,
    }];
  });

  return buildQuickMealCandidates(facts);
}
