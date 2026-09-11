import { describe, expect, it } from "vitest";

import {
  adaptDailyMetricDefinition,
  getProgressMetricDefinition,
  NUTRITION_PROGRESS_METRICS,
  type ProgressMetricDefinition,
  type ProgressMetricSample,
} from "../analytics";
import { buildProgressComparison } from "./engine";
import { parseProgressComparisonQuery, resolveProgressComparisonReference } from "./navigation";

const primary = { start: "2026-09-05", end: "2026-09-11" };
const previous = { start: "2026-08-29", end: "2026-09-04" };

function metric(key: string) {
  return getProgressMetricDefinition(key, NUTRITION_PROGRESS_METRICS)!;
}

function mapSamples(entries: Array<[string, readonly ProgressMetricSample[]]>) {
  return new Map<string, readonly ProgressMetricSample[]>(entries);
}

describe("Progress V2 comparison query", () => {
  it("resolves previous and another preset through the canonical period engine", () => {
    const previousQuery = parseProgressComparisonQuery({ compare: "previous", metrics: "nutrition.calories,nutrition.protein" });
    expect(resolveProgressComparisonReference({ query: previousQuery, primaryPeriod: primary, today: primary.end })?.reference)
      .toEqual({ type: "previous_period", period: previous, label: "Período anterior" });

    const otherQuery = parseProgressComparisonQuery({ compare: "period", refPeriod: "2w" });
    expect(resolveProgressComparisonReference({ query: otherQuery, primaryPeriod: primary, today: primary.end })?.reference)
      .toMatchObject({ type: "other_period", period: { start: "2026-08-22", end: "2026-09-04" } });
  });

  it("accepts a reproducible custom B range and rejects future-only ranges", () => {
    const custom = parseProgressComparisonQuery({ compare: "period", refPeriod: "custom", refFrom: "2026-07-01", refTo: "2026-07-28", view: "summary", chartMetric: "nutrition.protein" });
    expect(resolveProgressComparisonReference({ query: custom, primaryPeriod: primary, today: primary.end })).toMatchObject({
      reference: { type: "other_period", period: { start: "2026-07-01", end: "2026-07-28" } },
      error: null,
    });
    expect(custom).toMatchObject({ initialView: "summary", activeMetricKey: "nutrition.protein" });

    const future = parseProgressComparisonQuery({ compare: "period", refPeriod: "custom", refFrom: "2026-10-01", refTo: "2026-10-07" });
    expect(resolveProgressComparisonReference({ query: future, primaryPeriod: primary, today: primary.end })?.error).toMatch(/todavía/);
  });
});

describe("Progress V2 temporal comparisons", () => {
  it("calculates A/B, absolute and percentage deltas and aligned daily series", () => {
    const calories = metric("nutrition.calories");
    const samples = mapSamples([[calories.key, [
      { date: "2026-08-29", value: 2_000 },
      { date: "2026-08-30", value: 2_200 },
      { date: "2026-09-05", value: 1_800 },
      { date: "2026-09-06", value: 2_000 },
    ]]]);
    const report = buildProgressComparison({
      metrics: [calories], samplesByMetric: samples, primaryPeriod: primary, primaryLabel: "1 semana",
      reference: { type: "previous_period", period: previous, label: "Período anterior" },
      bucket: "day", minimumInsightCoverage: 0,
    });
    expect(report.results[0]).toMatchObject({ valueA: 1_900, valueB: 2_100, deltaAbsolute: -200 });
    expect(report.results[0]!.deltaPercent).toBeCloseTo(-9.5238);
    expect(report.results[0]!.alignedSeries).toHaveLength(7);
    expect(report.results[0]!.alignedSeries[0]).toMatchObject({ index: 0, primary: { start: "2026-09-05" }, reference: { start: "2026-08-29" } });
  });

  it("keeps a real zero baseline absolute but never returns infinity", () => {
    const calories = metric("nutrition.calories");
    const report = buildProgressComparison({
      metrics: [calories],
      samplesByMetric: mapSamples([[calories.key, [{ date: "2026-08-29", value: 0 }, { date: "2026-09-05", value: 100 }]]]),
      primaryPeriod: primary, primaryLabel: "Semana",
      reference: { type: "previous_period", period: previous, label: "Anterior" },
      minimumInsightCoverage: 0,
    });
    expect(report.results[0]).toMatchObject({ deltaAbsolute: 100, deltaPercent: null, change: "increased" });
  });

  it("does not turn an empty previous period into +48 or an infinite improvement", () => {
    const calories = metric("nutrition.calories");
    const report = buildProgressComparison({
      metrics: [calories],
      samplesByMetric: mapSamples([[calories.key, [{ date: "2026-09-05", value: 2_000 }]]]),
      primaryPeriod: primary, primaryLabel: "Semana",
      reference: { type: "previous_period", period: previous, label: "Anterior" },
      minimumInsightCoverage: 0,
    });
    expect(report.results[0]).toMatchObject({
      deltaAbsolute: null,
      deltaPercent: null,
      change: "insufficient_data",
      eligibility: { status: "insufficient_data", reason: "previous_period_empty" },
    });
  });

  it("classifies stable values and sign transitions without good/bad language", () => {
    const protein = metric("nutrition.protein");
    const balance = metric("nutrition.energy_balance");
    const samples = mapSamples([
      [protein.key, [{ date: "2026-08-29", value: 150 }, { date: "2026-09-05", value: 151 }]],
      [balance.key, [{ date: "2026-08-29", value: 300 }, { date: "2026-09-05", value: -200 }]],
    ]);
    const report = buildProgressComparison({
      metrics: [protein, balance], samplesByMetric: samples, primaryPeriod: primary, primaryLabel: "Semana",
      reference: { type: "previous_period", period: previous, label: "Anterior" }, minimumInsightCoverage: 0,
    });
    expect(report.results.map((result) => result.change)).toEqual(["stable", "surplus_to_deficit"]);
    expect(report.results[1]!.deltaPercent).toBeNull();
    expect(report.insights).toEqual([{ metricKey: balance.key, title: "Balance energético", description: "Pasaste de superávit a déficit.", change: "surplus_to_deficit" }]);
  });

  it("uses coverage to suppress weak insights while preserving the comparison detail", () => {
    const calories = metric("nutrition.calories");
    const report = buildProgressComparison({
      metrics: [calories], samplesByMetric: mapSamples([[calories.key, [
        { date: "2026-08-29", value: 1_000 }, { date: "2026-09-05", value: 2_000 },
      ]]]), primaryPeriod: primary, primaryLabel: "Semana",
      reference: { type: "previous_period", period: previous, label: "Anterior" },
    });
    expect(report.results[0]).toMatchObject({ eligibility: { status: "comparable" }, insightEligible: false });
    expect(report.insights).toEqual([]);
  });

  it("honors metric selection and can align weekly buckets", () => {
    const calories = metric("nutrition.calories");
    const protein = metric("nutrition.protein");
    const report = buildProgressComparison({
      metrics: [calories, protein], selectedMetricKeys: [protein.key],
      samplesByMetric: mapSamples([[protein.key, [
        { date: "2026-08-22", value: 120 }, { date: "2026-08-29", value: 125 },
        { date: "2026-09-05", value: 130 }, { date: "2026-09-12", value: 135 },
      ]]]),
      primaryPeriod: { start: "2026-09-05", end: "2026-09-18" }, primaryLabel: "2 semanas",
      reference: { type: "other_period", period: { start: "2026-08-22", end: "2026-09-04" }, label: "Otro período" },
      bucket: "week", minimumInsightCoverage: 0,
    });
    expect(report.selectedMetricKeys).toEqual([protein.key]);
    expect(report.results[0]!.alignedSeries).toHaveLength(2);
    expect(report.bucket).toBe("week");
  });
});

describe("Progress V2 goal comparisons", () => {
  it("uses historical nutrition target snapshots and counts minimum-goal attainment", () => {
    const protein = metric("nutrition.protein");
    const report = buildProgressComparison({
      metrics: [protein], primaryPeriod: primary, primaryLabel: "Semana",
      reference: { type: "goal", label: "Objetivo" },
      samplesByMetric: mapSamples([[protein.key, [{ date: "2026-09-05", value: 140 }, { date: "2026-09-06", value: 120 }]]]),
      goalsByMetric: new Map([[protein.key, {
        source: "historical_snapshot", rule: "minimum", samples: [{ date: "2026-09-05", value: 130 }, { date: "2026-09-06", value: 130 }],
      }]]), minimumInsightCoverage: 0,
    });
    expect(report.results[0]).toMatchObject({ valueA: 130, valueB: 130, deltaAbsolute: 0, deltaPercent: null });
    expect(report.results[0]!.reference).toMatchObject({ type: "goal", goal: { hitCount: 1, comparableCount: 2, source: "historical_snapshot" } });
  });

  it("labels dynamic targets as current references and does not hardcode metric names", () => {
    const dynamic = adaptDailyMetricDefinition({
      id: "bike", system_key: null, name: "Bicicleta", unit: "km", value_type: "decimal",
      target_value: 10, sort_order: 4, is_active: true, archived_at: null,
    });
    const report = buildProgressComparison({
      metrics: [dynamic], primaryPeriod: primary, primaryLabel: "Semana", reference: { type: "goal", label: "Objetivo" },
      samplesByMetric: mapSamples([[dynamic.key, [{ date: "2026-09-05", value: 12 }, { date: "2026-09-06", value: 8 }]]]),
      goalsByMetric: new Map([[dynamic.key, { source: "current_reference", rule: "minimum", value: 10 }]]), minimumInsightCoverage: 0,
    });
    expect(report.results[0]!.reference).toMatchObject({ type: "goal", goal: { source: "current_reference", hitCount: 1, comparableCount: 2 } });
  });

  it("returns an explicit unavailable-goal state", () => {
    const calories = { ...metric("nutrition.calories"), supportsGoal: true } satisfies ProgressMetricDefinition;
    const report = buildProgressComparison({
      metrics: [calories], primaryPeriod: primary, primaryLabel: "Semana", reference: { type: "goal", label: "Objetivo" },
      samplesByMetric: mapSamples([[calories.key, [{ date: "2026-09-05", value: 2_000 }]]]), goalsByMetric: new Map(),
    });
    expect(report.results[0]).toMatchObject({ valueB: null, deltaAbsolute: null, eligibility: { status: "insufficient_data", reason: "goal_unavailable" } });
  });

  it("requires observations aligned with historical target snapshots", () => {
    const protein = metric("nutrition.protein");
    const report = buildProgressComparison({
      metrics: [protein], primaryPeriod: primary, primaryLabel: "Semana", reference: { type: "goal", label: "Objetivo" },
      samplesByMetric: mapSamples([[protein.key, [{ date: "2026-09-05", value: 140 }]]]),
      goalsByMetric: new Map([[protein.key, {
        source: "historical_snapshot", rule: "minimum", samples: [{ date: "2026-09-06", value: 130 }],
      }]]),
    });
    expect(report.results[0]).toMatchObject({
      deltaAbsolute: null,
      eligibility: { status: "insufficient_data", reason: "goal_unavailable" },
    });
  });
});
