// M7.1 Progress contract, shared by the Mobile API adapter and Expo (pure; no server imports).
// Every analytic value is computed server-side by the Web Progress engine; Mobile only renders.
// missing != zero: absent values are null; an unavailable domain is never "empty" or "0".
import { isNutritionDate } from "./nutrition-day-contract";
import { REPORT_PRESETS, type ReportPreset, type ReportQuery } from "./nutrition-report-contract";

export const PROGRESS_PRESETS = REPORT_PRESETS;
export type ProgressPreset = ReportPreset;
export type ProgressQuery = ReportQuery;
export const PROGRESS_DEFAULT_PRESET: ProgressPreset = "30";
export const PROGRESS_CUSTOM_MAX_DAYS = 366;

export type ProgressBucket = "day" | "week" | "month";
export type ProgressPeriod = {
  preset: ProgressPreset; start: string; end: string; days: number;
  previousStart: string; previousEnd: string; bucket: ProgressBucket; includesToday: boolean;
};
export type ProgressComparisonStatus = "comparable" | "not_comparable" | "insufficient_data";
export type ProgressChange = "increased" | "decreased" | "stable" | "deficit_to_surplus" | "surplus_to_deficit" | "insufficient_data";
/** current vs previous equivalent period (engine result). Percent is null when not valid (baseline 0, metric disallows it). */
export type ProgressComparison = {
  status: ProgressComparisonStatus; reason: string; current: number | null; previous: number | null;
  deltaAbsolute: number | null; deltaPercent: number | null; change: ProgressChange;
};
export type ProgressCoverage = { registered: number; eligible: number | null; ratio: number | null };
export type ProgressDestination = { kind: "body" } | { kind: "nutrition" } | { kind: "metrics"; metricId: string | null };
export type ProgressRow = { id: string; label: string; value: string; detail: string | null; destination: ProgressDestination };
export type ProgressFinding = { id: string; domain: "body" | "nutrition" | "metrics"; label: string; description: string; destination: ProgressDestination };
export type ProgressSection<T> = { status: "ok"; data: T } | { status: "unavailable" };
export type MetricValueType = "integer" | "decimal" | "duration";

export type ProgressNutritionSummary = {
  averageKcal: number | null; averageProteinG: number | null; averageTargetKcal: number | null; averageTargetProteinG: number | null;
  accumulatedBalanceKcal: number | null; registeredDays: number; completedDays: number; days: number;
  calories: ProgressComparison; protein: ProgressComparison; balance: ProgressComparison;
};
export type ProgressMetricHabit = {
  id: string; name: string; unit: string | null; valueType: MetricValueType;
  average: number | null; coverage: ProgressCoverage; comparison: ProgressComparison;
};
export type ProgressOverview = {
  today: string; period: ProgressPeriod;
  evolution: ProgressRow[]; changes: ProgressFinding[];
  nutrition: ProgressSection<ProgressNutritionSummary>;
  metrics: ProgressSection<{ items: ProgressMetricHabit[] }>;
  body: ProgressSection<{ excludedSuspect: number; trackedMetrics: number }>;
  training: { status: "pending" };
};

export type BodyObservationDto = { date: string; value: number; imported: boolean; provenanceLabel: string };
export type BodyTrend = "increased" | "decreased" | "stable" | "variable" | "unavailable";
export type BodyConfidence = "unavailable" | "limited" | "supported";
export type ProgressBodyMetric = {
  key: string; label: string; unit: "kg" | "cm";
  latest: BodyObservationDto | null; first: BodyObservationDto | null; last: BodyObservationDto | null;
  change: number | null; referenceChange: number | null; trend: BodyTrend; confidence: BodyConfidence;
  observations: BodyObservationDto[]; referenceCount: number;
  comparison: { status: ProgressComparisonStatus; reason: string };
};
export type ProgressBody = { today: string; period: ProgressPeriod; excludedSuspect: number; metrics: ProgressBodyMetric[] };

export type ProgressMetricDefinition = {
  id: string; systemKey: string | null; name: string; unit: string | null; valueType: MetricValueType; isActive: boolean; currentTarget: number | null;
};
export type ProgressMetricSummary = {
  average: number | null; median: number | null; minimum: number | null; maximum: number | null;
  registeredDays: number; eligibleDays: number; coverageRatio: number | null; trendDelta: number | null; trendPercentDelta: number | null;
};
export type ProgressSeriesPoint = { start: string; end: string; value: number | null; samples: number };
export type ProgressMetrics = {
  today: string; period: ProgressPeriod; definitions: ProgressMetricDefinition[];
  metric: ProgressMetricDefinition | null; summary: ProgressMetricSummary | null;
  previous: { average: number | null; registeredDays: number; eligibleDays: number } | null;
  comparison: ProgressComparison | null; series: ProgressSeriesPoint[];
};

// ---- parsers (strict: unknown or inconsistent shapes are invalid responses) ----
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: readonly string[]) => Object.keys(v).length === names.length && names.every(n => n in v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOrNull = (v: unknown): v is number | null => v === null || num(v);
const count = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const str = (v: unknown): v is string => typeof v === "string";
const strOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";
const list = <T>(v: unknown, item: (x: unknown) => T | undefined): T[] | undefined => {
  if (!Array.isArray(v)) return;
  const out = v.map(item);
  return out.every((x): x is T => x !== undefined) ? out : undefined;
};
const VALUE_TYPES = ["integer", "decimal", "duration"];
const CHANGES = ["increased", "decreased", "stable", "deficit_to_surplus", "surplus_to_deficit", "insufficient_data"];
const STATUSES = ["comparable", "not_comparable", "insufficient_data"];

export function parseProgressQuery(v: unknown): ProgressQuery | undefined {
  if (!record(v) || !(PROGRESS_PRESETS as readonly unknown[]).includes(v.period)) return;
  if (v.period === "custom") {
    if (!keys(v, ["period", "from", "to"]) || !isNutritionDate(v.from) || !isNutritionDate(v.to) || v.from > v.to) return;
    return { period: "custom", from: v.from, to: v.to };
  }
  return keys(v, ["period"]) ? { period: v.period as ProgressPreset } : undefined;
}
export function progressQueryKey(q: ProgressQuery) { return q.period === "custom" ? `custom:${q.from}:${q.to}` : q.period; }
export function progressQueryString(q: ProgressQuery) {
  const params = new URLSearchParams({ period: q.period });
  if (q.period === "custom" && q.from && q.to) { params.set("from", q.from); params.set("to", q.to); }
  return params.toString();
}

export function parseProgressPeriod(v: unknown): ProgressPeriod | undefined {
  if (!record(v) || !keys(v, ["preset", "start", "end", "days", "previousStart", "previousEnd", "bucket", "includesToday"])
    || !(PROGRESS_PRESETS as readonly unknown[]).includes(v.preset) || !isNutritionDate(v.start) || !isNutritionDate(v.end) || v.start > v.end
    || !count(v.days) || v.days < 1 || v.days > PROGRESS_CUSTOM_MAX_DAYS || !isNutritionDate(v.previousStart) || !isNutritionDate(v.previousEnd)
    || v.previousEnd >= v.start || !["day", "week", "month"].includes(String(v.bucket)) || typeof v.includesToday !== "boolean") return;
  return v as ProgressPeriod;
}
export function parseProgressComparison(v: unknown): ProgressComparison | undefined {
  if (!record(v) || !keys(v, ["status", "reason", "current", "previous", "deltaAbsolute", "deltaPercent", "change"])
    || !STATUSES.includes(String(v.status)) || !str(v.reason) || !numOrNull(v.current) || !numOrNull(v.previous)
    || !numOrNull(v.deltaAbsolute) || !numOrNull(v.deltaPercent) || !CHANGES.includes(String(v.change))) return;
  // A percent never exists without a non-zero baseline.
  if (v.deltaPercent !== null && (v.previous === null || v.previous === 0)) return;
  if (v.status !== "comparable" && (v.deltaAbsolute !== null || v.deltaPercent !== null)) return;
  return v as ProgressComparison;
}
function parseCoverage(v: unknown): ProgressCoverage | undefined {
  if (!record(v) || !keys(v, ["registered", "eligible", "ratio"]) || !count(v.registered) || (v.eligible !== null && !count(v.eligible))
    || (v.ratio !== null && !(num(v.ratio) && v.ratio >= 0 && v.ratio <= 1))) return;
  return v as ProgressCoverage;
}
function parseDestination(v: unknown): ProgressDestination | undefined {
  if (!record(v)) return;
  if ((v.kind === "body" || v.kind === "nutrition") && keys(v, ["kind"])) return { kind: v.kind };
  if (v.kind === "metrics" && keys(v, ["kind", "metricId"]) && strOrNull(v.metricId)) return { kind: "metrics", metricId: v.metricId };
}
function parseRow(v: unknown): ProgressRow | undefined {
  if (!record(v) || !keys(v, ["id", "label", "value", "detail", "destination"]) || !str(v.id) || !str(v.label) || !str(v.value) || !strOrNull(v.detail)) return;
  const destination = parseDestination(v.destination);
  return destination ? { ...(v as ProgressRow), destination } : undefined;
}
function parseFinding(v: unknown): ProgressFinding | undefined {
  if (!record(v) || !keys(v, ["id", "domain", "label", "description", "destination"]) || !["body", "nutrition", "metrics"].includes(String(v.domain))
    || !str(v.id) || !str(v.label) || !str(v.description)) return;
  const destination = parseDestination(v.destination);
  return destination ? { ...(v as ProgressFinding), destination } : undefined;
}
function section<T>(v: unknown, parse: (x: unknown) => T | undefined): ProgressSection<T> | undefined {
  if (!record(v)) return;
  if (v.status === "unavailable" && keys(v, ["status"])) return { status: "unavailable" };
  if (v.status !== "ok" || !keys(v, ["status", "data"])) return;
  const data = parse(v.data);
  return data === undefined ? undefined : { status: "ok", data };
}
function parseNutrition(v: unknown): ProgressNutritionSummary | undefined {
  if (!record(v) || !keys(v, ["averageKcal", "averageProteinG", "averageTargetKcal", "averageTargetProteinG", "accumulatedBalanceKcal",
    "registeredDays", "completedDays", "days", "calories", "protein", "balance"])
    || !numOrNull(v.averageKcal) || !numOrNull(v.averageProteinG) || !numOrNull(v.averageTargetKcal) || !numOrNull(v.averageTargetProteinG)
    || !numOrNull(v.accumulatedBalanceKcal) || !count(v.registeredDays) || !count(v.completedDays) || !count(v.days)) return;
  const calories = parseProgressComparison(v.calories), protein = parseProgressComparison(v.protein), balance = parseProgressComparison(v.balance);
  return calories && protein && balance ? { ...(v as ProgressNutritionSummary), calories, protein, balance } : undefined;
}
function parseHabit(v: unknown): ProgressMetricHabit | undefined {
  if (!record(v) || !keys(v, ["id", "name", "unit", "valueType", "average", "coverage", "comparison"]) || !str(v.id) || !str(v.name)
    || !strOrNull(v.unit) || !VALUE_TYPES.includes(String(v.valueType)) || !numOrNull(v.average)) return;
  const coverage = parseCoverage(v.coverage), comparison = parseProgressComparison(v.comparison);
  return coverage && comparison ? { ...(v as ProgressMetricHabit), coverage, comparison } : undefined;
}
export function parseProgressOverview(v: unknown): ProgressOverview | undefined {
  if (!record(v) || !keys(v, ["today", "period", "evolution", "changes", "nutrition", "metrics", "body", "training"]) || !isNutritionDate(v.today)) return;
  const period = parseProgressPeriod(v.period);
  const evolution = list(v.evolution, parseRow), changes = list(v.changes, parseFinding);
  const nutrition = section(v.nutrition, parseNutrition);
  const metrics = section(v.metrics, d => {
    if (!record(d) || !keys(d, ["items"])) return;
    const items = list(d.items, parseHabit);
    return items ? { items } : undefined;
  });
  const body = section(v.body, d => record(d) && keys(d, ["excludedSuspect", "trackedMetrics"]) && count(d.excludedSuspect) && count(d.trackedMetrics)
    ? { excludedSuspect: d.excludedSuspect, trackedMetrics: d.trackedMetrics } : undefined);
  if (!period || period.end > v.today || !evolution || !changes || changes.length > 3 || !nutrition || !metrics || !body
    || !record(v.training) || v.training.status !== "pending" || !keys(v.training, ["status"])) return;
  // At most 2 findings per domain.
  const perDomain = new Map<string, number>();
  for (const f of changes) perDomain.set(f.domain, (perDomain.get(f.domain) ?? 0) + 1);
  if ([...perDomain.values()].some(n => n > 2)) return;
  return { today: v.today, period, evolution, changes, nutrition, metrics, body, training: { status: "pending" } };
}

function parseObservation(v: unknown): BodyObservationDto | undefined {
  if (!record(v) || !keys(v, ["date", "value", "imported", "provenanceLabel"]) || !isNutritionDate(v.date) || !num(v.value)
    || typeof v.imported !== "boolean" || !str(v.provenanceLabel)) return;
  return v as BodyObservationDto;
}
const obsOrNull = (v: unknown) => v === null ? null : parseObservation(v);
function parseBodyMetric(v: unknown): ProgressBodyMetric | undefined {
  if (!record(v) || !keys(v, ["key", "label", "unit", "latest", "first", "last", "change", "referenceChange", "trend", "confidence",
    "observations", "referenceCount", "comparison"]) || !str(v.key) || !str(v.label) || (v.unit !== "kg" && v.unit !== "cm")
    || !numOrNull(v.change) || !numOrNull(v.referenceChange) || !["increased", "decreased", "stable", "variable", "unavailable"].includes(String(v.trend))
    || !["unavailable", "limited", "supported"].includes(String(v.confidence)) || !count(v.referenceCount)
    || !record(v.comparison) || !keys(v.comparison, ["status", "reason"]) || !STATUSES.includes(String(v.comparison.status)) || !str(v.comparison.reason)) return;
  const latest = obsOrNull(v.latest), first = obsOrNull(v.first), last = obsOrNull(v.last), observations = list(v.observations, parseObservation);
  if (latest === undefined || first === undefined || last === undefined || !observations) return;
  // Chronological, and the summary must describe exactly these observations.
  if (observations.some((o, i) => i > 0 && o.date < observations[i - 1].date)) return;
  if ((observations.length > 0) !== (first !== null && last !== null)) return;
  if ((v.change !== null) !== (observations.length >= 2)) return;
  if (observations.length < 2 && v.trend !== "unavailable") return;
  return { ...(v as ProgressBodyMetric), latest, first, last, observations };
}
export function parseProgressBody(v: unknown): ProgressBody | undefined {
  if (!record(v) || !keys(v, ["today", "period", "excludedSuspect", "metrics"]) || !isNutritionDate(v.today) || !count(v.excludedSuspect)) return;
  const period = parseProgressPeriod(v.period), metrics = list(v.metrics, parseBodyMetric);
  return period && metrics ? { today: v.today, period, excludedSuspect: v.excludedSuspect, metrics } : undefined;
}

function parseDefinition(v: unknown): ProgressMetricDefinition | undefined {
  if (!record(v) || !keys(v, ["id", "systemKey", "name", "unit", "valueType", "isActive", "currentTarget"]) || !str(v.id) || !strOrNull(v.systemKey)
    || !str(v.name) || !strOrNull(v.unit) || !VALUE_TYPES.includes(String(v.valueType)) || typeof v.isActive !== "boolean" || !numOrNull(v.currentTarget)) return;
  return v as ProgressMetricDefinition;
}
function parseSummary(v: unknown): ProgressMetricSummary | undefined {
  if (!record(v) || !keys(v, ["average", "median", "minimum", "maximum", "registeredDays", "eligibleDays", "coverageRatio", "trendDelta", "trendPercentDelta"])
    || !numOrNull(v.average) || !numOrNull(v.median) || !numOrNull(v.minimum) || !numOrNull(v.maximum) || !count(v.registeredDays) || !count(v.eligibleDays)
    || !numOrNull(v.coverageRatio) || !numOrNull(v.trendDelta) || !numOrNull(v.trendPercentDelta)) return;
  if ((v.average === null) !== (v.registeredDays === 0)) return;
  return v as ProgressMetricSummary;
}
function parsePoint(v: unknown): ProgressSeriesPoint | undefined {
  if (!record(v) || !keys(v, ["start", "end", "value", "samples"]) || !isNutritionDate(v.start) || !isNutritionDate(v.end) || v.start > v.end
    || !numOrNull(v.value) || !count(v.samples) || ((v.value === null) !== (v.samples === 0))) return;
  return v as ProgressSeriesPoint;
}
export function parseProgressMetrics(v: unknown): ProgressMetrics | undefined {
  if (!record(v) || !keys(v, ["today", "period", "definitions", "metric", "summary", "previous", "comparison", "series"]) || !isNutritionDate(v.today)) return;
  const period = parseProgressPeriod(v.period), definitions = list(v.definitions, parseDefinition), series = list(v.series, parsePoint);
  if (!period || !definitions || !series) return;
  if (v.metric === null) {
    return v.summary === null && v.previous === null && v.comparison === null && series.length === 0
      ? { today: v.today, period, definitions, metric: null, summary: null, previous: null, comparison: null, series } : undefined;
  }
  const metric = parseDefinition(v.metric), summary = parseSummary(v.summary), comparison = parseProgressComparison(v.comparison);
  const previous = record(v.previous) && keys(v.previous, ["average", "registeredDays", "eligibleDays"]) && numOrNull(v.previous.average)
    && count(v.previous.registeredDays) && count(v.previous.eligibleDays) ? v.previous as ProgressMetrics["previous"] : undefined;
  if (!metric || !summary || !comparison || !previous || !definitions.some(d => d.id === metric.id)) return;
  if (series.some((p, i) => i > 0 && p.start <= series[i - 1].end)) return;
  return { today: v.today, period, definitions, metric, summary, previous, comparison, series };
}
