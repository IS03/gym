import {
  addProgressIsoDays,
  getPreviousProgressPeriod,
  isValidProgressIsoDate,
  PROGRESS_CUSTOM_RANGE_MAX_DAYS,
  progressRangeDays,
  resolveProgressPeriod,
  type ProgressPeriodRange,
  type ProgressPeriodPreset,
} from "../analytics";
import type {
  ProgressComparisonReference,
  ProgressComparisonReferenceType,
  ProgressComparisonView,
} from "./types";

export type ProgressComparisonQuery = {
  referenceType: ProgressComparisonReferenceType | null;
  referencePreset: ProgressPeriodPreset | null;
  referenceFrom: string | null;
  referenceTo: string | null;
  selectedMetricKeys: string[];
  activeMetricKey: string | null;
  initialView: ProgressComparisonView;
};

type SearchValue = string | string[] | undefined;

function single(value: SearchValue) {
  return typeof value === "string" ? value : null;
}

export function parseProgressComparisonQuery(search: Record<string, SearchValue>): ProgressComparisonQuery {
  const compare = single(search.compare);
  const referenceType = compare === "previous"
    ? "previous_period"
    : compare === "period"
      ? "other_period"
      : compare === "goal"
        ? "goal"
        : null;
  const refPeriod = single(search.refPeriod);
  const referencePreset = refPeriod === "custom" || ["1w", "2w", "3w", "4w", "30d", "8w", "3m", "6m", "1y"].includes(refPeriod ?? "")
    ? refPeriod as ProgressPeriodPreset
    : null;
  const selectedMetricKeys = [...new Set((single(search.metrics) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean))]
    .slice(0, 24);
  const view = single(search.view);
  return {
    referenceType,
    referencePreset,
    referenceFrom: single(search.refFrom),
    referenceTo: single(search.refTo),
    selectedMetricKeys,
    activeMetricKey: single(search.chartMetric),
    initialView: view === "summary" || view === "evolution" ? view : "insights",
  };
}

export function resolveProgressComparisonReference(input: {
  query: ProgressComparisonQuery;
  primaryPeriod: ProgressPeriodRange;
  today: string;
}): { reference: ProgressComparisonReference; error: string | null } | null {
  const type = input.query.referenceType;
  if (!type) return null;
  if (type === "goal") return { reference: { type, label: "Objetivo" }, error: null };
  if (type === "previous_period") {
    return {
      reference: { type, period: getPreviousProgressPeriod(input.primaryPeriod), label: "Período anterior" },
      error: null,
    };
  }

  const fallback = getPreviousProgressPeriod(input.primaryPeriod);
  if (input.query.referencePreset && input.query.referencePreset !== "custom") {
    const anchor = addProgressIsoDays(input.primaryPeriod.start, -1);
    const resolved = resolveProgressPeriod({ preset: input.query.referencePreset }, anchor);
    return {
      reference: { type, period: resolved.current, label: resolved.label },
      error: resolved.error,
    };
  }
  if (!isValidProgressIsoDate(input.query.referenceFrom) || !isValidProgressIsoDate(input.query.referenceTo)) {
    return { reference: { type, period: fallback, label: "Otro período" }, error: "Elegí fechas válidas para el período de comparación." };
  }
  if (input.query.referenceFrom > input.query.referenceTo) {
    return { reference: { type, period: fallback, label: "Otro período" }, error: "La fecha desde no puede ser posterior a la fecha hasta." };
  }
  if (input.query.referenceFrom > input.today) {
    return { reference: { type, period: fallback, label: "Otro período" }, error: "El período de comparación todavía no contiene días transcurridos." };
  }
  const period = {
    start: input.query.referenceFrom,
    end: input.query.referenceTo > input.today ? input.today : input.query.referenceTo,
  };
  if (progressRangeDays(period) > PROGRESS_CUSTOM_RANGE_MAX_DAYS) {
    return { reference: { type, period: fallback, label: "Otro período" }, error: `El período de comparación admite hasta ${PROGRESS_CUSTOM_RANGE_MAX_DAYS} días.` };
  }
  return { reference: { type, period, label: "Otro período" }, error: null };
}

export function progressComparisonQueryParams(query: ProgressComparisonQuery) {
  const compare = query.referenceType === "previous_period"
    ? "previous"
    : query.referenceType === "other_period"
      ? "period"
      : query.referenceType === "goal"
        ? "goal"
        : undefined;
  return {
    compare,
    refPeriod: query.referencePreset ?? undefined,
    refFrom: query.referenceFrom ?? undefined,
    refTo: query.referenceTo ?? undefined,
    metrics: query.selectedMetricKeys.length ? query.selectedMetricKeys.join(",") : undefined,
    chartMetric: query.activeMetricKey ?? undefined,
    view: query.referenceType ? query.initialView : undefined,
  };
}
