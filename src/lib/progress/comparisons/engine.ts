import {
  aggregateProgressSamples,
  compareMetricAnalyses,
  formatProgressMetricValue,
  getMetricAnalysis,
  progressBucketForDays,
  progressRangeDays,
  type ProgressComparisonEligibility,
  type ProgressMetricAnalysis,
  type ProgressMetricDefinition,
  type ProgressMetricSample,
  type ProgressMetricSeriesPoint,
} from "../analytics";
import type {
  BuildProgressComparisonInput,
  ProgressAlignedComparisonPoint,
  ProgressChangeKind,
  ProgressComparisonInsight,
  ProgressComparisonMetricResult,
  ProgressComparisonReport,
  ProgressGoalComparison,
  ProgressGoalReferenceInput,
} from "./types";

const DEFAULT_INSIGHT_COVERAGE = 0.5;

function knownSamples(samples: readonly ProgressMetricSample[], start: string, end: string) {
  return samples.filter((sample): sample is ProgressMetricSample & { value: number } => (
    sample.date >= start && sample.date <= end &&
    typeof sample.value === "number" && Number.isFinite(sample.value)
  ));
}

function coverageMeets(analysis: ProgressMetricAnalysis, minimum: number) {
  return analysis.coverage.coverageRatio === null || analysis.coverage.coverageRatio >= minimum;
}

function comparisonEligibilityForGoal(
  metric: ProgressMetricDefinition,
  primary: ProgressMetricAnalysis,
  goal: ProgressGoalComparison | null,
): ProgressComparisonEligibility {
  if (!metric.supportsGoal || !metric.goal) {
    return { status: "not_comparable", reason: "metric_disallows_goal" };
  }
  if (!goal) return { status: "insufficient_data", reason: "goal_unavailable" };
  if (goal.comparableCount === 0) return { status: "insufficient_data", reason: "goal_unavailable" };
  if (primary.coverage.sampleSize === 0) {
    return { status: "insufficient_data", reason: "current_period_empty" };
  }
  if (primary.coverage.sampleSize < metric.minimumSamples || primary.value === null) {
    return { status: "insufficient_data", reason: "insufficient_current_samples" };
  }
  return { status: "comparable", reason: "eligible" };
}

function goalHit(rule: ProgressGoalReferenceInput["rule"], value: number, goal: number) {
  if (rule === "minimum") return value >= goal;
  if (rule === "maximum") return value <= goal;
  return false;
}

function buildGoalComparison(input: {
  metric: ProgressMetricDefinition;
  goalInput: ProgressGoalReferenceInput | undefined;
  primarySamples: readonly ProgressMetricSample[];
  primary: ProgressMetricAnalysis;
  inProgressDate?: string | null;
}): ProgressGoalComparison | null {
  const goalInput = input.goalInput;
  if (!goalInput) return null;
  const goalSamples = knownSamples(
    goalInput.samples ?? [],
    input.primary.period.start,
    input.primary.period.end,
  ).filter((sample) => sample.date !== input.inProgressDate);
  const value = goalInput.value ?? aggregateProgressSamples("average", goalSamples);
  if (value === null || !Number.isFinite(value)) return null;

  const currentByDate = new Map(knownSamples(
    input.primarySamples,
    input.primary.period.start,
    input.primary.period.end,
  ).filter((sample) => sample.date !== input.inProgressDate).map((sample) => [sample.date, sample.value]));
  const goalByDate = new Map(goalSamples.map((sample) => [sample.date, sample.value]));
  const comparable = [...currentByDate].flatMap(([date, current]) => {
    const goal = goalInput.source === "current_reference" ? value : goalByDate.get(date);
    return goal === undefined ? [] : [{ current, goal }];
  });

  return {
    label: goalInput.label ?? (goalInput.source === "current_reference" ? "Objetivo actual" : "Objetivo del período"),
    source: goalInput.source,
    rule: goalInput.rule,
    value,
    formattedValue: formatProgressMetricValue(value, input.metric),
    sampleSize: goalInput.source === "current_reference" ? 1 : goalSamples.length,
    hitCount: goalInput.rule === "reference"
      ? null
      : comparable.filter((pair) => goalHit(goalInput.rule, pair.current, pair.goal)).length,
    comparableCount: comparable.length,
  };
}

function goalSeries(
  primary: ProgressMetricAnalysis,
  goal: ProgressGoalComparison,
  goalInput: ProgressGoalReferenceInput,
): ProgressMetricSeriesPoint[] {
  const goalSamples = goalInput.samples ?? [];
  return primary.series.map((point) => {
    const scoped = knownSamples(goalSamples, point.start, point.end);
    const value = goalInput.source === "current_reference"
      ? goal.value
      : aggregateProgressSamples("average", scoped);
    return { ...point, id: `goal-${point.id}`, value, sampleSize: scoped.length };
  });
}

function alignSeries(
  primary: readonly ProgressMetricSeriesPoint[],
  reference: readonly ProgressMetricSeriesPoint[],
): ProgressAlignedComparisonPoint[] {
  const count = Math.max(primary.length, reference.length);
  return Array.from({ length: count }, (_, index) => ({
    index,
    primary: primary[index] ?? null,
    reference: reference[index] ?? null,
  }));
}

function classifyChange(
  metric: ProgressMetricDefinition,
  valueA: number | null,
  valueB: number | null,
  deltaAbsolute: number | null,
  deltaPercent: number | null,
  eligibility: ProgressComparisonEligibility,
): ProgressChangeKind {
  if (eligibility.status !== "comparable" || valueA === null || valueB === null || deltaAbsolute === null) {
    return "insufficient_data";
  }
  if (metric.comparison?.signSemantic === "energy_balance") {
    if (valueB >= 0 && valueA < 0) return "surplus_to_deficit";
    if (valueB <= 0 && valueA > 0) return "deficit_to_surplus";
  }
  const absoluteThreshold = metric.comparison?.stableAbsoluteThreshold ?? 0;
  const percentThreshold = metric.comparison?.stablePercentThreshold ?? 3;
  const stable = Math.abs(deltaAbsolute) <= absoluteThreshold || (
    deltaPercent !== null && Math.abs(deltaPercent) < percentThreshold
  );
  if (stable) return "stable";
  return deltaAbsolute > 0 ? "increased" : "decreased";
}

function resultRelevance(result: ProgressComparisonMetricResult) {
  if (!result.insightEligible || result.change === "stable" || result.change === "insufficient_data") return 0;
  if (result.change === "deficit_to_surplus" || result.change === "surplus_to_deficit") return 1_000;
  if (result.deltaPercent !== null) return Math.abs(result.deltaPercent);
  if (result.deltaAbsolute === null) return 0;
  return Math.abs(result.deltaAbsolute) / Math.max(Math.abs(result.valueB ?? 0), 1) * 100;
}

function signedMetricValue(value: number, metric: ProgressMetricDefinition) {
  if (value === 0) return formatProgressMetricValue(0, metric);
  return `${value > 0 ? "+" : "−"}${formatProgressMetricValue(Math.abs(value), metric)}`;
}

function insightFor(result: ProgressComparisonMetricResult): ProgressComparisonInsight {
  const transition = result.change === "surplus_to_deficit"
    ? "Pasaste de superávit a déficit."
    : result.change === "deficit_to_surplus"
      ? "Pasaste de déficit a superávit."
      : null;
  const delta = result.deltaAbsolute === null ? "" : signedMetricValue(result.deltaAbsolute, result.metric);
  const percent = result.deltaPercent === null
    ? ""
    : ` · ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, signDisplay: "always" }).format(result.deltaPercent)}%`;
  return {
    metricKey: result.metric.key,
    title: result.metric.label,
    description: transition ?? `${result.formattedValueB} → ${result.formattedValueA} · ${delta}${percent}`,
    change: result.change as Exclude<ProgressChangeKind, "insufficient_data">,
  };
}

export function buildProgressComparison(input: BuildProgressComparisonInput): ProgressComparisonReport {
  const selected = new Set(input.selectedMetricKeys ?? input.metrics.map((metric) => metric.key));
  const metrics = input.metrics.filter((metric) => selected.has(metric.key));
  const referenceDays = input.reference.type === "goal"
    ? progressRangeDays(input.primaryPeriod)
    : progressRangeDays(input.reference.period);
  const bucket = input.bucket ?? progressBucketForDays(Math.max(progressRangeDays(input.primaryPeriod), referenceDays));
  const minimumInsightCoverage = input.minimumInsightCoverage ?? DEFAULT_INSIGHT_COVERAGE;

  const results = metrics.map<ProgressComparisonMetricResult>((metric) => {
    const primarySamples = input.samplesByMetric.get(metric.key) ?? [];
    const primary = getMetricAnalysis({
      metric,
      samples: primarySamples,
      period: input.primaryPeriod,
      bucket,
      inProgressDate: input.inProgressDate,
    });

    if (input.reference.type === "goal") {
      const goalInput = input.goalsByMetric?.get(metric.key);
      const goal = buildGoalComparison({ metric, goalInput, primarySamples, primary, inProgressDate: input.inProgressDate });
      const eligibility = comparisonEligibilityForGoal(metric, primary, goal);
      const valueB = goal?.value ?? null;
      const deltaAbsolute = eligibility.status === "comparable" ? primary.value! - valueB! : null;
      const alignedSeries = goal && goalInput
        ? alignSeries(primary.series, goalSeries(primary, goal, goalInput))
        : alignSeries(primary.series, []);
      const currentCoverage = coverageMeets(primary, minimumInsightCoverage);
      const change = classifyChange(metric, primary.value, valueB, deltaAbsolute, null, eligibility);
      const result: ProgressComparisonMetricResult = {
        metric,
        primary,
        reference: { type: "goal", goal: goal ?? {
          label: "Objetivo",
          source: metric.goal?.source ?? "current_reference",
          rule: metric.goal?.rule ?? "reference",
          value: null,
          formattedValue: "—",
          sampleSize: 0,
          hitCount: null,
          comparableCount: 0,
        } },
        valueA: primary.value,
        valueB,
        formattedValueA: primary.formattedValue,
        formattedValueB: goal?.formattedValue ?? "—",
        deltaAbsolute,
        deltaPercent: null,
        eligibility,
        alignedSeries,
        change,
        insightEligible: eligibility.status === "comparable" && currentCoverage,
        insightOmissionReason: eligibility.status !== "comparable" ? "comparison" : currentCoverage ? "eligible" : "current_coverage",
        relevanceScore: 0,
      };
      result.relevanceScore = resultRelevance(result);
      return result;
    }

    const referenceSamples = input.referenceSamplesByMetric?.get(metric.key) ?? primarySamples;
    const referenceAnalysis = getMetricAnalysis({
      metric,
      samples: referenceSamples,
      period: input.reference.period,
      bucket,
    });
    const comparison = compareMetricAnalyses({ current: primary, previous: referenceAnalysis });
    const deltaPercent = metric.comparison?.allowPercentDelta === false ? null : comparison.deltaPercent;
    const currentCoverage = coverageMeets(primary, minimumInsightCoverage);
    const referenceCoverage = coverageMeets(referenceAnalysis, minimumInsightCoverage);
    const change = classifyChange(metric, primary.value, referenceAnalysis.value, comparison.deltaAbsolute, deltaPercent, comparison.eligibility);
    const insightEligible = comparison.eligibility.status === "comparable" && currentCoverage && referenceCoverage;
    const result: ProgressComparisonMetricResult = {
      metric,
      primary,
      reference: { type: "period", analysis: referenceAnalysis },
      valueA: primary.value,
      valueB: referenceAnalysis.value,
      formattedValueA: primary.formattedValue,
      formattedValueB: referenceAnalysis.formattedValue,
      deltaAbsolute: comparison.deltaAbsolute,
      deltaPercent,
      eligibility: comparison.eligibility,
      alignedSeries: comparison.alignedSeries.map((point) => ({
        index: point.index,
        primary: point.current,
        reference: point.previous,
      })),
      change,
      insightEligible,
      insightOmissionReason: comparison.eligibility.status !== "comparable"
        ? "comparison"
        : !currentCoverage
          ? "current_coverage"
          : !referenceCoverage
            ? "reference_coverage"
            : "eligible",
      relevanceScore: 0,
    };
    result.relevanceScore = resultRelevance(result);
    return result;
  });

  const changed = results.filter((result) => result.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, 3)
    .map(insightFor);

  return {
    primaryPeriod: input.primaryPeriod,
    primaryLabel: input.primaryLabel,
    reference: input.reference,
    bucket,
    selectedMetricKeys: results.map((result) => result.metric.key),
    activeMetricKey: results.some((result) => result.metric.key === input.activeMetricKey)
      ? input.activeMetricKey ?? null
      : results[0]?.metric.key ?? null,
    initialView: input.initialView ?? "insights",
    results,
    insights: changed,
  };
}

export function comparisonCoverageLabel(analysis: ProgressMetricAnalysis) {
  const coverage = analysis.coverage;
  if (coverage.eligibleCount !== null) return `${coverage.registeredCount} de ${coverage.eligibleCount} días con registros`;
  if (analysis.metric.temporalOrigin === "session") return `${coverage.sampleSize} sesiones comparables`;
  return `${coverage.sampleSize} observaciones`;
}

export function comparisonInsufficientMessage(eligibility: ProgressComparisonEligibility) {
  if (eligibility.reason === "previous_period_empty") return "El período de comparación no tiene registros.";
  if (eligibility.reason === "current_period_empty") return "El período principal no tiene registros.";
  if (eligibility.reason === "goal_unavailable") return "No existe una referencia de objetivo válida.";
  if (eligibility.reason === "metric_disallows_goal") return "Esta métrica no admite comparación contra objetivo.";
  if (eligibility.status === "not_comparable") return "Esta métrica no es comparable en este contexto.";
  return "No hay suficientes observaciones para comparar.";
}
