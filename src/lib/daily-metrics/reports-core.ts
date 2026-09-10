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
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  trendDelta: number | null;
  trendPercentDelta: number | null;
  currentTargetReference: number | null;
  currentTargetHitDays: number;
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
): MetricReportSummary {
  const values = known(days.map((day) => day.value));
  const chronological = days
    .filter((day): day is MetricReportDay & { value: number } => day.value !== null && Number.isFinite(day.value))
    .sort((left, right) => left.date.localeCompare(right.date));
  const first = chronological[0]?.value ?? null;
  const last = chronological.at(-1)?.value ?? null;
  const trendDelta = first === null || last === null || chronological.length < 2 ? null : last - first;
  return {
    registeredDays: values.length,
    average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    trendDelta,
    trendPercentDelta: trendDelta === null || first === null || first === 0
      ? null
      : trendDelta / Math.abs(first) * 100,
    currentTargetReference: target,
    currentTargetHitDays: target === null ? 0 : values.filter((value) => value >= target).length,
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
