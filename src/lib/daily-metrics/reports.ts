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
import {
  adaptDailyMetricDefinition,
  dailyMetricSamples,
  type ProgressMetricSample,
} from "@/lib/progress/analytics";
import {
  buildProgressComparison,
  resolveProgressComparisonReference,
  type ProgressComparisonQuery,
  type ProgressGoalReferenceInput,
} from "@/lib/progress/comparisons";

function numberOrNull(value: unknown) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getDailyMetricsReport(
  input: {
    period?: string;
    from?: string;
    to?: string;
    metricId?: string;
    compare?: boolean;
    progressComparison?: ProgressComparisonQuery | null;
  },
  today: string,
  auth?: AuthenticatedRequestContext,
) {
  const { supabase, userId } = auth ?? await requireAuthenticatedRequestContext();
  const range = resolveNutritionReportRange(input, today);
  const previousRange = previousNutritionReportRange(range);
  const resolvedReference = input.progressComparison
    ? resolveProgressComparisonReference({ query: input.progressComparison, primaryPeriod: range, today })
    : null;
  const temporalReference = resolvedReference?.reference.type === "previous_period" || resolvedReference?.reference.type === "other_period"
    ? resolvedReference.reference.period
    : null;
  const readStart = temporalReference
    ? [range.start, temporalReference.start].sort()[0]!
    : input.compare ? previousRange.start : range.start;
  const readEnd = temporalReference
    ? [range.end, temporalReference.end].sort().at(-1)!
    : range.end;

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
      .lte("metric_date", readEnd),
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

  if (!metric) return { range, definitions, metric: null, days: [], summary: null, comparison: null, progressComparison: null, progressMetrics: [], comparisonError: null };

  const days = buildMetricReportDays({ range, today, metricId: metric.id, values });
  const summary = aggregateMetricReport(days, metric.target_value);
  const progressMetrics = definitions.map(adaptDailyMetricDefinition);
  let progressComparison = null;
  if (resolvedReference) {
    const samplesByMetric = new Map<string, readonly ProgressMetricSample[]>(progressMetrics.map((definition) => [
      definition.key,
      dailyMetricSamples(String(definition.source.field), values),
    ]));
    const goalsByMetric = new Map<string, ProgressGoalReferenceInput>(progressMetrics.flatMap((definition) => {
      const target = definition.metadata?.targetValue;
      if (!definition.goal || typeof target !== "number" || !Number.isFinite(target)) return [];
      return [[definition.key, {
        label: "Objetivo actual",
        source: definition.goal.source,
        rule: definition.goal.rule,
        value: target,
      }]];
    }));
    const requested = input.progressComparison?.selectedMetricKeys.filter((key) => progressMetrics.some((definition) => definition.key === key)) ?? [];
    const selectedMetricKeys = requested.length ? requested : [`activity.daily.${metric.id}`];
    progressComparison = buildProgressComparison({
      metrics: resolvedReference.reference.type === "goal"
        ? progressMetrics.filter((definition) => definition.supportsGoal)
        : progressMetrics,
      selectedMetricKeys,
      samplesByMetric,
      primaryPeriod: range,
      primaryLabel: range.preset,
      reference: resolvedReference.reference,
      goalsByMetric,
      inProgressDate: range.end === today ? today : null,
      activeMetricKey: input.progressComparison?.activeMetricKey,
      initialView: input.progressComparison?.initialView,
    });
  }
  if (!input.compare) return { range, definitions, metric, days, summary, comparison: null, progressComparison, progressMetrics, comparisonError: resolvedReference?.error ?? null };

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
    progressComparison,
    progressMetrics,
    comparisonError: resolvedReference?.error ?? null,
  };
}
