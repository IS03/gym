import type {
  ProgressBucketGranularity,
  ProgressComparisonEligibility,
  ProgressMetricAnalysis,
  ProgressMetricDefinition,
  ProgressMetricGoalRule,
  ProgressMetricGoalSource,
  ProgressMetricSample,
  ProgressMetricSeriesPoint,
  ProgressPeriodRange,
} from "../analytics";

export type ProgressComparisonReferenceType = "previous_period" | "other_period" | "goal";
export type ProgressComparisonView = "insights" | "summary" | "evolution";
export type ProgressChangeKind =
  | "increased"
  | "decreased"
  | "stable"
  | "deficit_to_surplus"
  | "surplus_to_deficit"
  | "insufficient_data";

export type ProgressTemporalComparisonReference = {
  type: "previous_period" | "other_period";
  period: ProgressPeriodRange;
  label: string;
};

export type ProgressGoalComparisonReference = {
  type: "goal";
  label: string;
};

export type ProgressComparisonReference =
  | ProgressTemporalComparisonReference
  | ProgressGoalComparisonReference;

export type ProgressGoalReferenceInput = {
  label?: string;
  source: ProgressMetricGoalSource;
  rule: ProgressMetricGoalRule;
  value?: number | null;
  samples?: readonly ProgressMetricSample[];
};

export type ProgressGoalComparison = {
  label: string;
  source: ProgressMetricGoalSource;
  rule: ProgressMetricGoalRule;
  value: number | null;
  formattedValue: string;
  sampleSize: number;
  hitCount: number | null;
  comparableCount: number;
};

export type ProgressAlignedComparisonPoint = {
  index: number;
  primary: ProgressMetricSeriesPoint | null;
  reference: ProgressMetricSeriesPoint | null;
};

export type ProgressComparisonMetricResult = {
  metric: ProgressMetricDefinition;
  primary: ProgressMetricAnalysis;
  reference:
    | { type: "period"; analysis: ProgressMetricAnalysis }
    | { type: "goal"; goal: ProgressGoalComparison };
  valueA: number | null;
  valueB: number | null;
  formattedValueA: string;
  formattedValueB: string;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  eligibility: ProgressComparisonEligibility;
  alignedSeries: ProgressAlignedComparisonPoint[];
  change: ProgressChangeKind;
  insightEligible: boolean;
  insightOmissionReason: "eligible" | "comparison" | "current_coverage" | "reference_coverage";
  relevanceScore: number;
};

export type ProgressComparisonInsight = {
  metricKey: string;
  title: string;
  description: string;
  change: Exclude<ProgressChangeKind, "insufficient_data">;
};

export type ProgressComparisonReport = {
  primaryPeriod: ProgressPeriodRange;
  primaryLabel: string;
  reference: ProgressComparisonReference;
  bucket: ProgressBucketGranularity;
  selectedMetricKeys: string[];
  activeMetricKey: string | null;
  initialView: ProgressComparisonView;
  results: ProgressComparisonMetricResult[];
  insights: ProgressComparisonInsight[];
};

export type BuildProgressComparisonInput = {
  metrics: readonly ProgressMetricDefinition[];
  selectedMetricKeys?: readonly string[];
  samplesByMetric: ReadonlyMap<string, readonly ProgressMetricSample[]>;
  referenceSamplesByMetric?: ReadonlyMap<string, readonly ProgressMetricSample[]>;
  goalsByMetric?: ReadonlyMap<string, ProgressGoalReferenceInput>;
  primaryPeriod: ProgressPeriodRange;
  primaryLabel: string;
  reference: ProgressComparisonReference;
  bucket?: ProgressBucketGranularity;
  inProgressDate?: string | null;
  activeMetricKey?: string | null;
  initialView?: ProgressComparisonView;
  minimumInsightCoverage?: number;
};
