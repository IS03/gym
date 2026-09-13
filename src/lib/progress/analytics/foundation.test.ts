import { describe, expect, it } from "vitest";

import type { BodyMeasurement } from "../../body-measurement-types";
import { bodyMeasurementSamples, dailyMetricSamples, trainingLoadMetricSamples } from "./adapters";
import {
  adaptDailyMetricDefinition,
  buildProgressMetricCatalog,
  getProgressMetricDefinition,
} from "./catalog";
import {
  aggregateProgressSamples,
  canCompareProgressMetrics,
  compareMetricAnalyses,
  getMetricAnalysis,
  getMetricSeries,
  getPeriodAnalysis,
} from "./engine";
import {
  bucketProgressRange,
  getPreviousProgressPeriod,
  progressRangeDays,
  resolveProgressPeriod,
} from "./periods";

describe("Progress analytics periods", () => {
  it("resolves current and immediately previous equivalent four-week ranges", () => {
    const result = resolveProgressPeriod({ preset: "4w" }, "2026-09-11");
    expect(result.current).toEqual({ start: "2026-08-15", end: "2026-09-11" });
    expect(result.previous).toEqual({ start: "2026-07-18", end: "2026-08-14" });
    expect(result.durationDays).toBe(28);
    expect(result.bucket).toBe("week");
  });

  it("uses calendar-month boundaries while keeping previous duration exactly equal", () => {
    const result = resolveProgressPeriod({ preset: "3m" }, "2026-05-31");
    expect(result.current).toEqual({ start: "2026-03-01", end: "2026-05-31" });
    expect(progressRangeDays(result.current)).toBe(progressRangeDays(result.previous));
    expect(result.previous.end).toBe("2026-02-28");
  });

  it("clamps a custom future end, rejects inverted dates and enforces the maximum", () => {
    expect(resolveProgressPeriod(
      { preset: "custom", from: "2026-09-01", to: "2026-09-30" },
      "2026-09-11",
    ).current.end).toBe("2026-09-11");
    expect(resolveProgressPeriod(
      { preset: "custom", from: "2026-09-10", to: "2026-09-01" },
      "2026-09-11",
    ).error).toMatch(/posterior/);
    expect(resolveProgressPeriod(
      { preset: "custom", from: "2025-01-01", to: "2026-09-11" },
      "2026-09-11",
    ).error).toMatch(/366/);
  });

  it("buckets short, intermediate and long ranges without gaps", () => {
    expect(bucketProgressRange({ start: "2026-09-01", end: "2026-09-03" }, "day"))
      .toHaveLength(3);
    expect(bucketProgressRange({ start: "2026-08-15", end: "2026-09-11" }, "week"))
      .toEqual([
        { start: "2026-08-15", end: "2026-08-21" },
        { start: "2026-08-22", end: "2026-08-28" },
        { start: "2026-08-29", end: "2026-09-04" },
        { start: "2026-09-05", end: "2026-09-11" },
      ]);
    expect(bucketProgressRange({ start: "2026-08-15", end: "2026-10-03" }, "month"))
      .toEqual([
        { start: "2026-08-15", end: "2026-08-31" },
        { start: "2026-09-01", end: "2026-09-30" },
        { start: "2026-10-01", end: "2026-10-03" },
      ]);
  });

  it("derives previous custom periods independently from preset names", () => {
    expect(getPreviousProgressPeriod({ start: "2026-09-03", end: "2026-09-11" }))
      .toEqual({ start: "2026-08-25", end: "2026-09-02" });
  });
});

describe("Progress metric catalog", () => {
  it("combines canonical metrics with active and archived user definitions", () => {
    const dynamic = [
      { id: "energy", system_key: null, name: "Energía", unit: "/10", value_type: "decimal", target_value: null, sort_order: 4, is_active: true, archived_at: null },
      { id: "old", system_key: null, name: "Dolor", unit: "/10", value_type: "integer", target_value: 2, sort_order: 5, is_active: false, archived_at: "2026-09-01T00:00:00Z" },
    ] as const;
    const catalog = buildProgressMetricCatalog(dynamic);
    const energy = getProgressMetricDefinition("activity.daily.energy", catalog);
    const archived = getProgressMetricDefinition("activity.daily.old", catalog);
    expect(energy?.source.canonicalTables).toEqual(["user_metrics", "daily_metric_values"]);
    expect(energy?.relation.model).toBe("configurable");
    expect(archived?.metadata).toMatchObject({ isActive: false, archivedAt: "2026-09-01T00:00:00Z" });
    expect(archived?.goal).toEqual({ rule: "reference", source: "current_reference" });
    expect(catalog.some((metric) => metric.key === "training.load.volume")).toBe(true);
    expect(catalog.some((metric) => metric.key === "training.performance.best_weight")).toBe(true);
  });

  it("does not hardcode system daily metrics in the static catalog", () => {
    const catalog = buildProgressMetricCatalog();
    expect(catalog.some((metric) => metric.domain === "activity")).toBe(false);
  });
});

describe("Progress aggregation, missing data and coverage", () => {
  const catalog = buildProgressMetricCatalog();
  const calories = getProgressMetricDefinition("nutrition.calories", catalog)!;
  const sessions = getProgressMetricDefinition("training.load.sessions", catalog)!;
  const weight = getProgressMetricDefinition("body.weight", catalog)!;
  const period = { start: "2026-09-05", end: "2026-09-11" };

  it("supports average, sum, latest and change without coercing null to zero", () => {
    const samples = [
      { date: "2026-09-05", value: 2 },
      { date: "2026-09-06", value: null },
      { date: "2026-09-07", value: 8 },
    ];
    expect(aggregateProgressSamples("average", samples)).toBe(5);
    expect(aggregateProgressSamples("sum", samples)).toBe(10);
    expect(aggregateProgressSamples("latest", samples)).toBe(8);
    expect(aggregateProgressSamples("change", samples)).toBe(6);
    expect(aggregateProgressSamples("average", [{ date: "2026-09-05", value: null }])).toBeNull();
  });

  it("excludes an in-progress day from average and coverage", () => {
    const result = getMetricAnalysis({
      metric: calories,
      period,
      inProgressDate: "2026-09-11",
      samples: [
        { date: "2026-09-05", value: 2_000 },
        { date: "2026-09-06", value: 2_200 },
        { date: "2026-09-11", value: 500 },
      ],
    });
    expect(result.value).toBe(2_100);
    expect(result.coverage).toMatchObject({ registeredCount: 2, eligibleCount: 6, sampleSize: 2 });
    expect(result.coverage.coverageRatio).toBeCloseTo(1 / 3);
  });

  it("keeps event-stream zero semantics separate from an empty comparison baseline", () => {
    const empty = getMetricAnalysis({ metric: sessions, period, samples: [] });
    expect(empty.value).toBe(0);
    expect(empty.series.every((point) => point.value === 0)).toBe(true);
    expect(empty.coverage.coverageRatio).toBeNull();
    expect(empty.comparisonEligibility).toEqual({ status: "insufficient_data", reason: "current_period_empty" });
  });

  it("requires two irregular body measurements for a change", () => {
    const one = getMetricAnalysis({ metric: weight, period, samples: [{ date: "2026-09-05", value: 65 }] });
    const two = getMetricAnalysis({ metric: weight, period, samples: [{ date: "2026-09-05", value: 65 }, { date: "2026-09-10", value: 64 }] });
    expect(one.value).toBeNull();
    expect(one.comparisonEligibility.reason).toBe("insufficient_current_samples");
    expect(two.value).toBe(-1);
    expect(two.firstValue).toBe(65);
    expect(two.lastValue).toBe(64);
    expect(two.coverage.eligibleCount).toBeNull();
  });

  it("builds coherent basic series and multi-metric analyses", () => {
    const samples = [{ date: "2026-09-05", value: 100 }, { date: "2026-09-07", value: 200 }];
    const series = getMetricSeries({ metric: calories, period, bucket: "week", samples });
    expect(series).toEqual([{ id: "2026-09-05", start: "2026-09-05", end: "2026-09-11", value: 150, sampleSize: 2 }]);
    const result = getPeriodAnalysis({
      metrics: [calories, sessions],
      samplesByMetric: new Map([[calories.key, samples], [sessions.key, [{ date: "2026-09-06", value: 1 }]]]),
      period,
    });
    expect(result.map((item) => item.value)).toEqual([150, 1]);
  });
});

describe("Progress comparability", () => {
  const catalog = buildProgressMetricCatalog();
  const calories = getProgressMetricDefinition("nutrition.calories", catalog)!;
  const bestWeight = getProgressMetricDefinition("training.performance.best_weight", catalog)!;
  const periodA = { start: "2026-09-05", end: "2026-09-11" };
  const periodB = { start: "2026-08-29", end: "2026-09-04" };

  it("does not turn an empty previous period into an infinite improvement", () => {
    const current = getMetricAnalysis({ metric: calories, period: periodA, samples: [{ date: "2026-09-05", value: 2_000 }] });
    const previous = getMetricAnalysis({ metric: calories, period: periodB, samples: [] });
    expect(compareMetricAnalyses({ current, previous })).toMatchObject({
      deltaAbsolute: null,
      deltaPercent: null,
      eligibility: { status: "insufficient_data", reason: "previous_period_empty" },
    });
  });

  it("keeps an absolute delta but omits percentage for a real zero baseline", () => {
    const metric = { ...calories, minimumSamples: 1 };
    const current = getMetricAnalysis({ metric, period: periodA, samples: [{ date: "2026-09-05", value: 10 }] });
    const previous = getMetricAnalysis({ metric, period: periodB, samples: [{ date: "2026-08-29", value: 0 }] });
    expect(compareMetricAnalyses({ current, previous })).toMatchObject({
      deltaAbsolute: 10,
      deltaPercent: null,
      eligibility: { status: "comparable" },
    });
  });

  it("requires the same exercise and weight mode for performance", () => {
    const current = getMetricAnalysis({ metric: bestWeight, period: periodA, samples: [{ date: "2026-09-05", value: 20 }] });
    const previous = getMetricAnalysis({ metric: bestWeight, period: periodB, samples: [{ date: "2026-08-29", value: 17.5 }] });
    expect(canCompareProgressMetrics({
      current,
      previous,
      currentContext: { exerciseId: "press", weightMode: "mancuernas" },
      previousContext: { exerciseId: "remo", weightMode: "mancuernas" },
    }).reason).toBe("different_exercise");
    expect(canCompareProgressMetrics({
      current,
      previous,
      currentContext: { exerciseId: "press", weightMode: "mancuernas" },
      previousContext: { exerciseId: "press", weightMode: "máquina" },
    }).reason).toBe("different_weight_mode");
    expect(compareMetricAnalyses({
      current,
      previous,
      currentContext: { exerciseId: "press", weightMode: "mancuernas" },
      previousContext: { exerciseId: "press", weightMode: "mancuernas" },
    })).toMatchObject({ deltaAbsolute: 2.5, eligibility: { status: "comparable" } });
  });
});

describe("Progress source adapters", () => {
  it("reads dynamic values by definition id", () => {
    const metric = adaptDailyMetricDefinition({
      id: "sleep", system_key: "sleep", name: "Sueño", unit: "min", value_type: "duration",
      target_value: 480, sort_order: 3, is_active: true, archived_at: null,
    });
    expect(metric.key).toBe("activity.daily.sleep");
    expect(dailyMetricSamples("sleep", [
      { metric_id: "sleep", metric_date: "2026-09-10", value: 440 },
      { metric_id: "water", metric_date: "2026-09-10", value: 2.5 },
    ])).toEqual([{ date: "2026-09-10", value: 440 }]);
  });

  it("excludes suspect body measurements unless explicitly requested", () => {
    const base = {
      id: "1", user_id: "u", measured_on: "2026-09-10", waist_cm: 74,
      abdomen_cm: null, chest_cm: null, arm_cm: null, arm_right_cm: null, arm_left_cm: null,
      thigh_cm: null, thigh_right_cm: null, thigh_left_cm: null, calf_right_cm: null,
      calf_left_cm: null, hip_cm: null, condition: null, notes: null, legacy_import_source: null,
      legacy_import_id: null, import_run_id: null, quality_note: "Revisar", source_payload: null,
      created_at: "2026-09-10T00:00:00Z", updated_at: "2026-09-10T00:00:00Z",
    } satisfies Omit<BodyMeasurement, "quality_status">;
    const suspect = { ...base, quality_status: "suspect" as const };
    expect(bodyMeasurementSamples("waist_cm", [suspect])).toEqual([]);
    expect(bodyMeasurementSamples("waist_cm", [suspect], { includeSuspect: true })).toHaveLength(1);
  });

  it("keeps empty training buckets as missing events so the engine can detect an empty baseline", () => {
    expect(trainingLoadMetricSamples("training.load.sessions", [{
      id: "2026-09-01", start: "2026-09-01", end: "2026-09-07", sessions: 0,
      sets: 0, minutes: 0, volumeKg: 0, exerciseCount: 0, hasData: false,
    }])).toEqual([]);
  });
});
