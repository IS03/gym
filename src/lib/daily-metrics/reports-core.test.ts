import { describe, expect, it } from "vitest";

import {
  aggregateMetricReport,
  availableMetricDefinitions,
  buildMetricReportDays,
  compareMetricReports,
  selectMetricDefinition,
  type MetricReportDefinition,
} from "./reports-core";

const range = { start: "2026-09-01", end: "2026-09-03" };

function metric(overrides: Partial<MetricReportDefinition> = {}): MetricReportDefinition {
  return {
    id: "metric-steps",
    system_key: "steps",
    name: "Pasos",
    unit: "pasos",
    value_type: "integer",
    target_value: 10_000,
    sort_order: 0,
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

describe("PR74 — reportes genéricos de métricas", () => {
  it("incluye métricas custom y conserva archivadas aunque el rango elegido no tenga valores", () => {
    const definitions = availableMetricDefinitions([
      metric(),
      metric({ id: "bike", system_key: null, name: "Bicicleta", unit: "km", value_type: "decimal", target_value: 10, sort_order: 4 }),
      metric({ id: "sleep-old", system_key: "sleep", name: "Sueño", unit: "min", value_type: "duration", is_active: false, archived_at: "2026-08-01T00:00:00Z", sort_order: 3 }),
    ]);

    expect(definitions.map((item) => item.id)).toEqual(["metric-steps", "bike", "sleep-old"]);
    expect(selectMetricDefinition(definitions, "bike")?.name).toBe("Bicicleta");
  });

  it("distingue ausencia de cero y calcula promedio, mínimo, máximo, cobertura y tendencia", () => {
    const days = buildMetricReportDays({
      range,
      today: "2026-09-03",
      metricId: "water",
      values: [
        { metric_id: "water", metric_date: "2026-09-01", value: 0 },
        { metric_id: "water", metric_date: "2026-09-03", value: 3 },
      ],
    });
    const summary = aggregateMetricReport(days, 2.5);

    expect(days.map((day) => day.value)).toEqual([3, null, 0]);
    expect(summary).toMatchObject({
      registeredDays: 2,
      average: 1.5,
      minimum: 0,
      maximum: 3,
      trendDelta: 3,
      trendPercentDelta: null,
      eligibleDays: 3,
      coverageRatio: 2 / 3,
      median: 1.5,
      currentTargetHitDays: null,
    });
  });

  it("promedia sólo registros presentes: 2 L, ausencia y 3 L dan 2,5 L", () => {
    const days = buildMetricReportDays({
      range,
      today: "2026-09-03",
      metricId: "water",
      values: [
        { metric_id: "water", metric_date: "2026-09-01", value: 2 },
        { metric_id: "water", metric_date: "2026-09-03", value: 3 },
      ],
    });
    expect(aggregateMetricReport(days, null)).toMatchObject({ registeredDays: 2, average: 2.5 });
  });

  it("devuelve un estado vacío real cuando no hay datos", () => {
    const days = buildMetricReportDays({ range, today: "2026-09-03", metricId: "bike", values: [] });
    expect(aggregateMetricReport(days, 10)).toMatchObject({
      registeredDays: 0,
      average: null,
      minimum: null,
      maximum: null,
      trendDelta: null,
      currentTargetReference: 10,
      eligibleDays: 3,
      coverageRatio: 0,
      currentTargetHitDays: null,
    });
  });

  it("no penaliza el día en curso y conserva cero como observación real", () => {
    const days = buildMetricReportDays({
      range,
      today: "2026-09-03",
      metricId: "focus",
      values: [
        { metric_id: "focus", metric_date: "2026-09-01", value: 0 },
        { metric_id: "focus", metric_date: "2026-09-03", value: 10 },
      ],
    });
    expect(aggregateMetricReport(days, null, { excludeInProgressDay: true })).toMatchObject({
      registeredDays: 1,
      eligibleDays: 2,
      coverageRatio: 0.5,
      average: 0,
    });
  });

  it("compara contra el período anterior de igual duración sin cruzar variables", () => {
    const currentDays = buildMetricReportDays({
      range,
      today: "2026-09-03",
      metricId: "bike",
      values: [
        { metric_id: "bike", metric_date: "2026-09-01", value: 8 },
        { metric_id: "bike", metric_date: "2026-09-02", value: 12 },
      ],
    });
    const previousRange = { start: "2026-08-29", end: "2026-08-31" };
    const previousDays = buildMetricReportDays({
      range: previousRange,
      today: "2026-09-03",
      metricId: "bike",
      values: [
        { metric_id: "bike", metric_date: "2026-08-29", value: 5 },
        { metric_id: "other", metric_date: "2026-08-30", value: 1_000 },
        { metric_id: "bike", metric_date: "2026-08-31", value: 7 },
      ],
    });
    const comparison = compareMetricReports(
      aggregateMetricReport(currentDays, 10),
      aggregateMetricReport(previousDays, 10),
      previousRange,
      previousDays,
    );

    expect(comparison).toMatchObject({ averageDelta: 4, averagePercentDelta: 66.66666666666666 });
    expect(comparison.previousRange).toEqual(previousRange);
  });
});
