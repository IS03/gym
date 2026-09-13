import type { MetricValueType, SystemMetricKey } from "./core";
import { listIsoDates, type NutritionReportDateRange } from "../nutrition/reports-core";

export type MetricReportDefinition = {
  id: string;
  system_key: SystemMetricKey | null;
  name: string;
  unit: string | null;
  value_type: MetricValueType;
  target_value: number | null;
  sort_order: number;
  is_active: boolean;
  archived_at: string | null;
};

export type MetricReportValueFact = {
  metric_id: string;
  metric_date: string;
  value: number;
};

export type MetricReportDay = {
  date: string;
  value: number | null;
  isToday: boolean;
};

export type MetricReportSummary = {
  registeredDays: number;
  eligibleDays: number;
  coverageRatio: number | null;
  average: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  trendDelta: number | null;
  trendPercentDelta: number | null;
  currentTargetReference: number | null;
  currentTargetHitDays: number | null;
};

export type MetricReportComparison = {
  current: MetricReportSummary;
  previous: MetricReportSummary;
  averageDelta: number | null;
  averagePercentDelta: number | null;
  previousRange: NutritionReportDateRange;
  previousDays: MetricReportDay[];
};

function known(values: Array<number | null>) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function availableMetricDefinitions(metrics: MetricReportDefinition[]) {
  return [...metrics].sort((left, right) => {
      if (left.is_active !== right.is_active) return left.is_active ? -1 : 1;
      return left.sort_order - right.sort_order || left.name.localeCompare(right.name, "es");
    });
}

export function selectMetricDefinition(
  metrics: MetricReportDefinition[],
  selectedId?: string,
) {
  return metrics.find((metric) => metric.id === selectedId) ?? metrics[0] ?? null;
}

export function buildMetricReportDays(input: {
  range: NutritionReportDateRange;
  today: string;
  metricId: string;
  values: MetricReportValueFact[];
}): MetricReportDay[] {
  const byDate = new Map(
    input.values
      .filter((value) => value.metric_id === input.metricId)
      .map((value) => [value.metric_date, value.value]),
  );
  return listIsoDates(input.range.start, input.range.end).map((date) => ({
    date,
    value: byDate.get(date) ?? null,
    isToday: date === input.today,
  }));
}

export function aggregateMetricReport(
  days: MetricReportDay[],
  target: number | null,
  options: { excludeInProgressDay?: boolean } = {},
): MetricReportSummary {
  const eligible = options.excludeInProgressDay ? days.filter((day) => !day.isToday) : days;
  const values = known(eligible.map((day) => day.value));
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0
    ? null
    : sorted.length % 2
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const chronological = eligible
    .filter((day): day is MetricReportDay & { value: number } => day.value !== null && Number.isFinite(day.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const first = chronological[0]?.value ?? null;
  const last = chronological.at(-1)?.value ?? null;
  const trendDelta = first === null || last === null || chronological.length < 2 ? null : last - first;
  return {
    registeredDays: values.length,
    eligibleDays: eligible.length,
    coverageRatio: eligible.length ? values.length / eligible.length : null,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    median,
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    trendDelta,
    trendPercentDelta: trendDelta === null || first === null || first === 0
      ? null
      : trendDelta / Math.abs(first) * 100,
    currentTargetReference: target,
    // The canonical definition currently has no target direction. A numeric
    // target is therefore a reference, not a minimum-compliance rule.
    currentTargetHitDays: null,
  };
}

export function compareMetricReports(
  current: MetricReportSummary,
  previous: MetricReportSummary,
  previousRange: NutritionReportDateRange,
  previousDays: MetricReportDay[],
): MetricReportComparison {
  const averageDelta = current.average === null || previous.average === null
    ? null
    : current.average - previous.average;
  return {
    current,
    previous,
    averageDelta,
    averagePercentDelta: averageDelta === null || previous.average === null || previous.average === 0
      ? null
      : averageDelta / Math.abs(previous.average) * 100,
    previousRange,
    previousDays,
  };
}
