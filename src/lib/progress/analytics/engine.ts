import {
  bucketProgressRange,
  progressBucketForDays,
  progressRangeDays,
} from "./periods";
import type {
  ProgressBucketGranularity,
  ProgressComparisonContext,
  ProgressComparisonEligibility,
  ProgressCoverage,
  ProgressMetricAnalysis,
  ProgressMetricComparison,
  ProgressMetricDefinition,
  ProgressMetricSample,
  ProgressMetricSeriesPoint,
  ProgressPeriodRange,
} from "./types";

function knownSamples(samples: readonly ProgressMetricSample[], range: ProgressPeriodRange) {
  return samples
    .filter((sample): sample is ProgressMetricSample & { value: number } => (
      sample.date >= range.start && sample.date <= range.end &&
      typeof sample.value === "number" && Number.isFinite(sample.value)
    ))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function aggregateProgressSamples(
  aggregation: ProgressMetricDefinition["aggregation"],
  samples: readonly ProgressMetricSample[],
): number | null {
  const values = samples
    .filter((sample): sample is ProgressMetricSample & { value: number } => (
      typeof sample.value === "number" && Number.isFinite(sample.value)
    ))
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((sample) => sample.value);
  if (values.length === 0) return null;
  if (aggregation === "sum") return values.reduce((total, value) => total + value, 0);
  if (aggregation === "average") return values.reduce((total, value) => total + value, 0) / values.length;
  if (aggregation === "latest") return values.at(-1)!;
  if (aggregation === "change") return values.length < 2 ? null : values.at(-1)! - values[0]!;
  return Math.max(...values);
}

export function getProgressCoverage(input: {
  metric: ProgressMetricDefinition;
  samples: readonly ProgressMetricSample[];
  period: ProgressPeriodRange;
  inProgressDate?: string | null;
}): ProgressCoverage {
  const samples = knownSamples(input.samples, input.period)
    .filter((sample) => sample.date !== input.inProgressDate);
  const registeredCount = new Set(samples.map((sample) => sample.date)).size;

  if (input.metric.coverageMode === "samples_only") {
    return { mode: "samples_only", registeredCount, eligibleCount: null, coverageRatio: null, sampleSize: samples.length };
  }

  let eligibleCount = progressRangeDays(input.period);
  if (input.inProgressDate && input.inProgressDate >= input.period.start && input.inProgressDate <= input.period.end) {
    eligibleCount -= 1;
  }
  if (input.metric.coverageMode === "event_stream") {
    return { mode: "event_stream", registeredCount, eligibleCount, coverageRatio: null, sampleSize: samples.length };
  }
  return {
    mode: "eligible_days",
    registeredCount,
    eligibleCount,
    coverageRatio: eligibleCount > 0 ? registeredCount / eligibleCount : null,
    sampleSize: samples.length,
  };
}

export function formatProgressMetricValue(value: number | null, metric: ProgressMetricDefinition): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const valueType = metric.metadata?.valueType;
  if (valueType === "duration" && Number.isInteger(value)) {
    const sign = value < 0 ? "−" : "";
    const absolute = Math.abs(value);
    const hours = Math.floor(absolute / 60);
    const minutes = absolute % 60;
    if (!hours) return `${sign}${minutes} min`;
    return `${sign}${hours} h${minutes ? ` ${minutes} min` : ""}`;
  }
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: metric.format.maximumFractionDigits,
    signDisplay: metric.format.signDisplay,
  }).format(value);
  return metric.unit ? `${formatted} ${metric.unit}` : formatted;
}

function selfEligibility(
  metric: ProgressMetricDefinition,
  sampleSize: number,
): ProgressComparisonEligibility {
  if (!metric.supportsTemporalComparison) {
    return { status: "not_comparable", reason: "metric_disallows_comparison" };
  }
  if (sampleSize === 0) return { status: "insufficient_data", reason: "current_period_empty" };
  if (sampleSize < metric.minimumSamples) {
    return { status: "insufficient_data", reason: "insufficient_current_samples" };
  }
  return { status: "comparable", reason: "eligible" };
}

export function getMetricSeries(input: {
  metric: ProgressMetricDefinition;
  samples: readonly ProgressMetricSample[];
  period: ProgressPeriodRange;
  bucket?: ProgressBucketGranularity;
  inProgressDate?: string | null;
}): ProgressMetricSeriesPoint[] {
  const bucket = input.bucket ?? progressBucketForDays(progressRangeDays(input.period));
  const samples = knownSamples(input.samples, input.period)
    .filter((sample) => sample.date !== input.inProgressDate);
  return bucketProgressRange(input.period, bucket).map((range) => {
    const scoped = samples.filter((sample) => sample.date >= range.start && sample.date <= range.end);
    const aggregated = aggregateProgressSamples(input.metric.aggregation, scoped);
    return {
      id: range.start,
      ...range,
      value: aggregated ?? (input.metric.missingData === "zero_when_no_event" ? 0 : null),
      sampleSize: scoped.length,
    };
  });
}

export function getMetricAnalysis(input: {
  metric: ProgressMetricDefinition;
  samples: readonly ProgressMetricSample[];
  period: ProgressPeriodRange;
  bucket?: ProgressBucketGranularity;
  inProgressDate?: string | null;
}): ProgressMetricAnalysis {
  const samples = knownSamples(input.samples, input.period)
    .filter((sample) => sample.date !== input.inProgressDate);
  const coverage = getProgressCoverage(input);
  const aggregated = aggregateProgressSamples(input.metric.aggregation, samples);
  const value = aggregated ?? (input.metric.missingData === "zero_when_no_event" ? 0 : null);
  return {
    metric: input.metric,
    period: input.period,
    value,
    formattedValue: formatProgressMetricValue(value, input.metric),
    aggregation: input.metric.aggregation,
    coverage,
    comparisonEligibility: selfEligibility(input.metric, coverage.sampleSize),
    series: getMetricSeries(input),
    firstValue: samples[0]?.value ?? null,
    lastValue: samples.at(-1)?.value ?? null,
  };
}

function normalizedContext(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase("es-AR");
  return normalized || null;
}

export function canCompareProgressMetrics(input: {
  current: ProgressMetricAnalysis;
  previous: ProgressMetricAnalysis;
  currentContext?: ProgressComparisonContext;
  previousContext?: ProgressComparisonContext;
}): ProgressComparisonEligibility {
  const current = input.current;
  const previous = input.previous;
  if (!current.metric.supportsTemporalComparison || !previous.metric.supportsTemporalComparison) {
    return { status: "not_comparable", reason: "metric_disallows_comparison" };
  }
  if (current.metric.key !== previous.metric.key) {
    return { status: "not_comparable", reason: "different_metric" };
  }
  if (current.metric.comparisonScope === "same_exercise_and_weight_mode") {
    const currentExercise = normalizedContext(input.currentContext?.exerciseId);
    const previousExercise = normalizedContext(input.previousContext?.exerciseId);
    const currentMode = normalizedContext(input.currentContext?.weightMode);
    const previousMode = normalizedContext(input.previousContext?.weightMode);
    if (!currentExercise || !previousExercise || !currentMode || !previousMode) {
      return { status: "not_comparable", reason: "missing_comparison_context" };
    }
    if (currentExercise !== previousExercise) return { status: "not_comparable", reason: "different_exercise" };
    if (currentMode !== previousMode) return { status: "not_comparable", reason: "different_weight_mode" };
  }
  if (current.coverage.sampleSize === 0) return { status: "insufficient_data", reason: "current_period_empty" };
  if (previous.coverage.sampleSize === 0) return { status: "insufficient_data", reason: "previous_period_empty" };
  if (current.coverage.sampleSize < current.metric.minimumSamples) {
    return { status: "insufficient_data", reason: "insufficient_current_samples" };
  }
  if (previous.coverage.sampleSize < previous.metric.minimumSamples) {
    return { status: "insufficient_data", reason: "insufficient_previous_samples" };
  }
  if (current.value === null || previous.value === null) {
    return {
      status: "insufficient_data",
      reason: current.value === null ? "insufficient_current_samples" : "insufficient_previous_samples",
    };
  }
  return { status: "comparable", reason: "eligible" };
}

export function compareMetricAnalyses(input: {
  current: ProgressMetricAnalysis;
  previous: ProgressMetricAnalysis;
  currentContext?: ProgressComparisonContext;
  previousContext?: ProgressComparisonContext;
}): ProgressMetricComparison {
  const eligibility = canCompareProgressMetrics(input);
  const canCompare = eligibility.status === "comparable";
  const deltaAbsolute = canCompare ? input.current.value! - input.previous.value! : null;
  const deltaPercent = deltaAbsolute !== null && input.previous.value !== 0
    ? deltaAbsolute / Math.abs(input.previous.value!) * 100
    : null;
  const count = Math.max(input.current.series.length, input.previous.series.length);
  return {
    current: input.current,
    previous: input.previous,
    deltaAbsolute,
    deltaPercent,
    eligibility,
    alignedSeries: Array.from({ length: count }, (_, index) => ({
      index,
      current: input.current.series[index] ?? null,
      previous: input.previous.series[index] ?? null,
    })),
  };
}

export function getPeriodAnalysis(input: {
  metrics: readonly ProgressMetricDefinition[];
  samplesByMetric: ReadonlyMap<string, readonly ProgressMetricSample[]>;
  period: ProgressPeriodRange;
  bucket?: ProgressBucketGranularity;
  inProgressDate?: string | null;
}): ProgressMetricAnalysis[] {
  return input.metrics.map((metric) => getMetricAnalysis({
    metric,
    samples: input.samplesByMetric.get(metric.key) ?? [],
    period: input.period,
    bucket: input.bucket,
    inProgressDate: input.inProgressDate,
  }));
}
