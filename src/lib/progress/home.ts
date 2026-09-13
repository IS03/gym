import { formatDailyMetricValue } from "../daily-metrics/core";
import type { MetricReportDefinition } from "@/lib/daily-metrics/reports-core";
import type { NutritionReportSummary } from "@/lib/nutrition/reports-core";
import type { BodyProgressReport } from "@/lib/progress/body";
import type { ProgressComparisonReport } from "@/lib/progress/comparisons";
import type { HighlightedRelationship } from "@/lib/progress/relationships";
import type { TrainingGeneralAnalytics } from "@/lib/progress/training-performance";
import { PROGRESS_PERIOD_PRESETS, type ProgressResolvedPeriod } from "./analytics";

export const PROGRESS_HOME_SECTION_ORDER = [
  "Tu evolución",
  "Qué cambió",
  "Relaciones",
  "Tus hábitos",
  "Explorar tu progreso",
  "Revisar datos",
] as const;

export type ProgressHomeDestination =
  | "training"
  | "nutrition"
  | "body"
  | "activity"
  | "relationships"
  | "calendar"
  | "history";

export type ProgressHomeRow = {
  id: string;
  label: string;
  value: string;
  detail: string | null;
  href: string;
};

export type ProgressHomeInsight = {
  id: string;
  domain: "training" | "body" | "activity" | "nutrition";
  label: string;
  description: string;
  href: string;
};

export type ProgressHomeModel = {
  evolution: ProgressHomeRow[];
  changes: ProgressHomeInsight[];
  relationships: HighlightedRelationship[];
  habits: ProgressHomeRow[];
  hasAnyData: boolean;
};

type HomeInput = {
  period: ProgressResolvedPeriod;
  training: TrainingGeneralAnalytics | null;
  nutrition: { summary: NutritionReportSummary; comparison: ProgressComparisonReport } | null;
  body: BodyProgressReport | null;
  activity: { definitions: MetricReportDefinition[]; comparison: ProgressComparisonReport } | null;
  relationships: readonly HighlightedRelationship[];
};

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

const nativePeriods: Record<Exclude<ProgressHomeDestination, "calendar" | "history">, Readonly<Record<string, string>>> = {
  training: { "1w": "1w", "2w": "2w", "3w": "3w", "4w": "4w", "8w": "8w", "3m": "3m", "6m": "6m", "1y": "1y" },
  nutrition: { "1w": "7", "2w": "14", "30d": "30", "3m": "3m", "6m": "6m", "1y": "1y" },
  body: { "1w": "1w", "2w": "2w", "3w": "3w", "4w": "4w", "30d": "30d", "8w": "8w", "3m": "3m", "6m": "6m", "1y": "1y" },
  activity: { "1w": "7", "2w": "14", "30d": "30", "3m": "3m", "6m": "6m", "1y": "1y" },
  relationships: { "1w": "1w", "2w": "2w", "3w": "3w", "4w": "4w", "30d": "30d", "8w": "8w", "3m": "3m", "6m": "6m", "1y": "1y" },
};

const homePeriodAliases: Readonly<Record<string, string>> = {
  "7": "1w",
  "14": "2w",
  "30": "30d",
};
const homePeriodPresets: ReadonlySet<string> = new Set(PROGRESS_PERIOD_PRESETS.map((preset) => preset.value));

/** Returns to Home without losing the period resolved by a destination screen. */
export function progressHomeHref(period: { preset: string; start: string; end: string }) {
  const preset = homePeriodAliases[period.preset] ?? period.preset;
  if (preset !== "custom" && homePeriodPresets.has(preset)) {
    return `/progress?${new URLSearchParams({ period: preset }).toString()}`;
  }
  return `/progress?${new URLSearchParams({ period: "custom", from: period.start, to: period.end }).toString()}`;
}

/** Keeps the exact selected dates when a destination lacks the same named preset. */
export function progressHomePeriodQuery(
  destination: Exclude<ProgressHomeDestination, "calendar" | "history">,
  period: ProgressResolvedPeriod,
) {
  const mapped = period.preset === "custom" ? null : nativePeriods[destination][period.preset];
  if (mapped) return { period: mapped };
  return { period: "custom", from: period.current.start, to: period.current.end };
}

function appendPeriod(params: URLSearchParams, query: ReturnType<typeof progressHomePeriodQuery>) {
  params.set("period", query.period);
  if (query.from && query.to) {
    params.set("from", query.from);
    params.set("to", query.to);
  }
}

export function progressHomeDestinationHref(
  destination: ProgressHomeDestination,
  period: ProgressResolvedPeriod,
  options: { metricId?: string; aKey?: string; bKey?: string } = {},
) {
  if (destination === "calendar") return "/calendar";
  if (destination === "history") return "/history";

  const paths = {
    training: "/train/progress",
    nutrition: "/today/reports",
    body: "/train/body",
    activity: "/progress/metrics",
    relationships: "/progress/relationships",
  } as const;
  const params = new URLSearchParams();
  appendPeriod(params, progressHomePeriodQuery(destination, period));
  if (destination === "training") params.set("view", "general");
  if (destination === "nutrition" || destination === "activity") params.set("compare", "previous");
  if (destination === "activity" && options.metricId) params.set("metric", options.metricId);
  if (destination === "relationships" && options.aKey && options.bKey) {
    params.set("a", options.aKey);
    params.set("b", options.bKey);
    params.set("analyze", "1");
  }
  return `${paths[destination]}?${params.toString()}`;
}

function signed(value: number, unit: string) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${decimal.format(Math.abs(value))} ${unit}`;
}

function bodyRows(body: BodyProgressReport | null, period: ProgressResolvedPeriod) {
  if (!body) return [];
  const priority = new Map(["body.weight", "body.waist", "body.abdomen"].map((key, index) => [key, index]));
  return body.metrics
    .filter((metric) => metric.last && metric.change !== null && metric.current.length >= 2 && Math.abs(metric.change) >= 0.1)
    .sort((left, right) => (priority.get(left.key) ?? 20) - (priority.get(right.key) ?? 20))
    .slice(0, 2)
    .map((metric): ProgressHomeRow => ({
      id: metric.key,
      label: metric.label,
      value: `${decimal.format(metric.last!.value)} ${metric.unit}`,
      detail: `${signed(metric.change!, metric.unit)} en el período`,
      href: progressHomeDestinationHref("body", period),
    }));
}

function metricDefinitionId(result: ProgressComparisonReport["results"][number]) {
  const value = result.metric.metadata?.definitionId;
  return typeof value === "string" ? value : null;
}

function activityHabits(
  activity: HomeInput["activity"],
  period: ProgressResolvedPeriod,
) {
  if (!activity) return [];
  const definitions = new Map(activity.definitions.map((definition) => [definition.id, definition]));
  return activity.comparison.results.flatMap((result): ProgressHomeRow[] => {
    const id = metricDefinitionId(result);
    const definition = id ? definitions.get(id) : null;
    if (!id || !definition?.is_active || result.valueA === null || result.primary.coverage.sampleSize === 0) return [];
    const coverage = result.primary.coverage;
    const detail = coverage.coverageRatio !== null && coverage.coverageRatio < 0.5 && coverage.eligibleCount !== null
      ? `${coverage.registeredCount} de ${coverage.eligibleCount} días registrados`
      : null;
    return [{
      id: result.metric.key,
      label: definition.name,
      value: formatDailyMetricValue(result.valueA, definition),
      detail,
      href: progressHomeDestinationHref("activity", period, { metricId: id }),
    }];
  }).slice(0, 3);
}

type RankedInsight = ProgressHomeInsight & { rank: number };

function normalizedCopy(value: string) {
  return value.trim().toLocaleLowerCase("es-AR").replace(/\s+/g, " ");
}

function selectChanges(input: HomeInput, evolutionIds: ReadonlySet<string>) {
  const candidates: RankedInsight[] = [];

  for (const [index, finding] of (input.training?.performance.findings ?? []).entries()) {
    if (!finding.signal) continue;
    candidates.push({
      id: `training:${finding.exerciseId}`,
      domain: "training",
      label: finding.name,
      description: finding.signal.description,
      href: progressHomeDestinationHref("training", input.period),
      rank: 500 - index,
    });
  }

  for (const [index, insight] of (input.body?.insights ?? []).entries()) {
    if (evolutionIds.has(insight.metricKey)) continue;
    candidates.push({
      id: `body:${insight.metricKey}`,
      domain: "body",
      label: insight.title,
      description: insight.description,
      href: progressHomeDestinationHref("body", input.period),
      rank: 400 - index,
    });
  }

  const activeMetricIds = new Set((input.activity?.definitions ?? []).filter((definition) => definition.is_active).map((definition) => definition.id));
  for (const insight of input.activity?.comparison.insights ?? []) {
    const result = input.activity?.comparison.results.find((entry) => entry.metric.key === insight.metricKey);
    const definitionId = result ? metricDefinitionId(result) : null;
    if (!definitionId || !activeMetricIds.has(definitionId)) continue;
    candidates.push({
      id: `activity:${insight.metricKey}`,
      domain: "activity",
      label: insight.title,
      description: insight.description,
      href: progressHomeDestinationHref("activity", input.period, { metricId: definitionId }),
      rank: 300 + (result?.relevanceScore ?? 0),
    });
  }

  for (const insight of input.nutrition?.comparison.insights ?? []) {
    const result = input.nutrition?.comparison.results.find((entry) => entry.metric.key === insight.metricKey);
    candidates.push({
      id: `nutrition:${insight.metricKey}`,
      domain: "nutrition",
      label: insight.title,
      description: insight.description,
      href: progressHomeDestinationHref("nutrition", input.period),
      rank: 200 + (result?.relevanceScore ?? 0),
    });
  }

  const seen = new Set<string>();
  const domainCounts = new Map<ProgressHomeInsight["domain"], number>();
  return candidates.sort((left, right) => right.rank - left.rank).flatMap((candidate): ProgressHomeInsight[] => {
    const fingerprint = `${normalizedCopy(candidate.label)}:${normalizedCopy(candidate.description)}`;
    if (seen.has(fingerprint) || (domainCounts.get(candidate.domain) ?? 0) >= 2) return [];
    seen.add(fingerprint);
    domainCounts.set(candidate.domain, (domainCounts.get(candidate.domain) ?? 0) + 1);
    return [{
      id: candidate.id,
      domain: candidate.domain,
      label: candidate.label,
      description: candidate.description,
      href: candidate.href,
    }];
  }).slice(0, 3);
}

export function buildProgressHomeModel(input: HomeInput): ProgressHomeModel {
  const evolution: ProgressHomeRow[] = [];
  const trainingSummary = input.training?.performance.summary;
  if (trainingSummary && trainingSummary.comparable > 0) {
    evolution.push({
      id: "training.performance",
      label: "Rendimiento de entrenamiento",
      value: trainingSummary.headline,
      detail: trainingSummary.context ?? (trainingSummary.insufficient ? `${trainingSummary.insufficient} sin comparación suficiente` : null),
      href: progressHomeDestinationHref("training", input.period),
    });
  }
  evolution.push(...bodyRows(input.body, input.period));
  const visibleEvolution = evolution.slice(0, 3);
  const evolutionIds = new Set(visibleEvolution.map((item) => item.id));

  const habits: ProgressHomeRow[] = [];
  const nutrition = input.nutrition?.summary;
  if (nutrition && (nutrition.calories.averageConsumed !== null || nutrition.protein.averageConsumed !== null)) {
    habits.push({
      id: "nutrition",
      label: "Nutrición",
      value: nutrition.calories.averageConsumed === null ? "Consumo registrado" : `${integer.format(nutrition.calories.averageConsumed)} kcal/día`,
      detail: nutrition.protein.averageConsumed === null ? null : `${decimal.format(nutrition.protein.averageConsumed)} g proteína/día`,
      href: progressHomeDestinationHref("nutrition", input.period),
    });
  }
  habits.push(...activityHabits(input.activity, input.period));

  const changes = selectChanges(input, evolutionIds);
  const relationships = [...input.relationships].slice(0, 3);
  return {
    evolution: visibleEvolution,
    changes,
    relationships,
    habits: habits.slice(0, 4),
    hasAnyData: visibleEvolution.length > 0 || changes.length > 0 || relationships.length > 0 || habits.length > 0,
  };
}
