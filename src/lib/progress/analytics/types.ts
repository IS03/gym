export const PROGRESS_METRIC_DOMAINS = ["nutrition", "activity", "body", "training"] as const;

export type ProgressMetricDomain = (typeof PROGRESS_METRIC_DOMAINS)[number];
export type ProgressMetricAggregation = "average" | "sum" | "latest" | "change" | "max" | "best";
export type ProgressTemporalOrigin = "day" | "measurement" | "session" | "set";
export type ProgressMissingDataBehavior = "exclude" | "zero_when_no_event";
export type ProgressCoverageMode = "eligible_days" | "samples_only" | "event_stream";
export type ProgressRelationModel = "acute" | "chronic" | "configurable";
export type ProgressBucketGranularity = "day" | "week" | "month";
export type ProgressComparisonStatus = "comparable" | "not_comparable" | "insufficient_data";

export type ProgressMetricSource = {
  adapter:
    | "nutrition_day"
    | "daily_metric"
    | "weight_history"
    | "body_measurement"
    | "training_load"
    | "exercise_performance";
  canonicalTables: readonly string[];
  field?: string;
};

export type ProgressMetricDefinition = {
  key: string;
  domain: ProgressMetricDomain;
  category: string;
  label: string;
  unit: string | null;
  source: ProgressMetricSource;
  temporalOrigin: ProgressTemporalOrigin;
  aggregation: ProgressMetricAggregation;
  missingData: ProgressMissingDataBehavior;
  coverageMode: ProgressCoverageMode;
  supportsGoal: boolean;
  supportsTemporalComparison: boolean;
  minimumSamples: number;
  comparisonScope: "same_metric" | "same_exercise_and_weight_mode";
  relation: {
    model: ProgressRelationModel;
    suggestedLagDays: readonly number[];
    minimumWindowDays: number;
  };
  format: {
    maximumFractionDigits: number;
    signDisplay?: "auto" | "always";
  };
  metadata?: Readonly<Record<string, unknown>>;
};

export type ProgressMetricSample = {
  date: string;
  value: number | null;
  entityId?: string | null;
  context?: Readonly<Record<string, unknown>>;
};

export type ProgressPeriodRange = {
  start: string;
  end: string;
};

export type ProgressResolvedPeriod = {
  preset: string;
  label: string;
  current: ProgressPeriodRange;
  previous: ProgressPeriodRange;
  durationDays: number;
  bucket: ProgressBucketGranularity;
  includesInProgressDay: boolean;
  error: string | null;
};

export type ProgressCoverage = {
  mode: ProgressCoverageMode;
  registeredCount: number;
  eligibleCount: number | null;
  coverageRatio: number | null;
  sampleSize: number;
};

export type ProgressComparisonEligibility = {
  status: ProgressComparisonStatus;
  reason:
    | "eligible"
    | "metric_disallows_comparison"
    | "different_metric"
    | "missing_comparison_context"
    | "different_exercise"
    | "different_weight_mode"
    | "current_period_empty"
    | "previous_period_empty"
    | "insufficient_current_samples"
    | "insufficient_previous_samples";
};

export type ProgressMetricSeriesPoint = {
  id: string;
  start: string;
  end: string;
  value: number | null;
  sampleSize: number;
};

export type ProgressMetricAnalysis = {
  metric: ProgressMetricDefinition;
  period: ProgressPeriodRange;
  value: number | null;
  formattedValue: string;
  aggregation: ProgressMetricAggregation;
  coverage: ProgressCoverage;
  comparisonEligibility: ProgressComparisonEligibility;
  series: ProgressMetricSeriesPoint[];
  firstValue: number | null;
  lastValue: number | null;
};

export type ProgressMetricComparison = {
  current: ProgressMetricAnalysis;
  previous: ProgressMetricAnalysis;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  eligibility: ProgressComparisonEligibility;
  alignedSeries: Array<{
    index: number;
    current: ProgressMetricSeriesPoint | null;
    previous: ProgressMetricSeriesPoint | null;
  }>;
};

export type ProgressComparisonContext = {
  exerciseId?: string | null;
  weightMode?: string | null;
};
