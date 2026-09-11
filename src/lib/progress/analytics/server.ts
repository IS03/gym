import "server-only";

import {
  requireAuthenticatedRequestContext,
  type AuthenticatedRequestContext,
} from "@/lib/supabase/server";
import {
  buildProgressMetricCatalog,
  type DynamicMetricDefinitionInput,
} from "./catalog";

function numberOrNull(value: unknown): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** One definition read builds the static + per-user catalog without per-metric queries. */
export async function getProgressMetricCatalog(
  auth?: AuthenticatedRequestContext,
) {
  const { supabase, userId } = auth ?? await requireAuthenticatedRequestContext();
  const ensured = await supabase.rpc("ensure_user_metrics");
  if (ensured.error) throw new Error(`Inicializar métricas de Progreso: ${ensured.error.message}`);

  const { data, error } = await supabase
    .from("user_metrics")
    .select("id,system_key,name,unit,value_type,target_value,sort_order,is_active,archived_at")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`Leer catálogo de Progreso: ${error.message}`);

  const dynamic = (data ?? []).map((row) => ({
    ...row,
    target_value: numberOrNull(row.target_value),
  })) as DynamicMetricDefinitionInput[];
  return buildProgressMetricCatalog(dynamic);
}
