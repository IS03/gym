import "server-only";

import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import {
  previousNutritionReportRange,
  resolveNutritionReportRange,
} from "@/lib/nutrition/reports-core";
import {
  aggregateMetricReport,
  availableMetricDefinitions,
  buildMetricReportDays,
  compareMetricReports,
  selectMetricDefinition,
  type MetricReportDefinition,
  type MetricReportValueFact,
} from "./reports-core";

function numberOrNull(value: unknown) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getDailyMetricsReport(
  input: { period?: string; from?: string; to?: string; metricId?: string; compare?: boolean },
  today: string,
  auth?: AuthenticatedRequestContext,
) {
  const { supabase, userId } = auth ?? await requireAuthenticatedRequestContext();
  const range = resolveNutritionReportRange(input, today);
  const previousRange = previousNutritionReportRange(range);
  const readStart = input.compare ? previousRange.start : range.start;

  const ensured = await supabase.rpc("ensure_user_metrics");
  if (ensured.error) throw new Error(`Inicializar métricas: ${ensured.error.message}`);

  const [metricResult, valueResult] = await Promise.all([
    supabase
      .from("user_metrics")
      .select("id,system_key,name,unit,value_type,target_value,sort_order,is_active,archived_at")
      .eq("user_id", userId),
    supabase
      .from("daily_metric_values")
      .select("metric_id,metric_date,value")
      .eq("user_id", userId)
      .gte("metric_date", readStart)
      .lte("metric_date", range.end),
  ]);
  if (metricResult.error) throw new Error(`Leer métricas para Progreso: ${metricResult.error.message}`);
  if (valueResult.error) throw new Error(`Leer valores para Progreso: ${valueResult.error.message}`);

  const metrics = (metricResult.data ?? []).map((row) => ({
    ...row,
    target_value: numberOrNull(row.target_value),
  })) as MetricReportDefinition[];
  const values = (valueResult.data ?? []).map((row) => ({
    metric_id: String(row.metric_id),
    metric_date: String(row.metric_date),
    value: Number(row.value),
  })).filter((row) => Number.isFinite(row.value)) as MetricReportValueFact[];
  const definitions = availableMetricDefinitions(metrics);
  const metric = selectMetricDefinition(definitions, input.metricId);

  if (!metric) return { range, definitions, metric: null, days: [], summary: null, comparison: null };

  const days = buildMetricReportDays({ range, today, metricId: metric.id, values });
  const summary = aggregateMetricReport(days, metric.target_value);
  if (!input.compare) return { range, definitions, metric, days, summary, comparison: null };

  const previousDays = buildMetricReportDays({
    range: previousRange,
    today,
    metricId: metric.id,
    values,
  });
  const previousSummary = aggregateMetricReport(previousDays, metric.target_value);
  return {
    range,
    definitions,
    metric,
    days,
    summary,
    comparison: compareMetricReports(summary, previousSummary, previousRange, previousDays),
  };
}
