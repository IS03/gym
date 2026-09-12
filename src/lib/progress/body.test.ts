import { describe, expect, it } from "vitest";

import type { BodyMeasurement } from "../body-measurement-types";
import { resolveProgressPeriod } from "./analytics";
import {
  bodyMetricObservations,
  bodyTrend,
  buildBodyProgressReport,
} from "./body";
import { BODY_PROGRESS_METRICS } from "./analytics/catalog";
import type { WeightHistoryPoint } from "../weight-history";

function measurement(overrides: Partial<BodyMeasurement> = {}): BodyMeasurement {
  return {
    id: "measurement-1",
    user_id: "user-1",
    measured_on: "2026-09-01",
    waist_cm: null,
    abdomen_cm: null,
    chest_cm: null,
    arm_cm: null,
    arm_right_cm: null,
    arm_left_cm: null,
    thigh_cm: null,
    thigh_right_cm: null,
    thigh_left_cm: null,
    calf_right_cm: null,
    calf_left_cm: null,
    hip_cm: null,
    condition: null,
    notes: null,
    legacy_import_source: null,
    legacy_import_id: null,
    import_run_id: null,
    quality_status: "verified",
    quality_note: null,
    source_payload: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const current = { start: "2026-08-16", end: "2026-09-12" };
const previous = { start: "2026-07-19", end: "2026-08-15" };

describe("Cuerpo V2 analytics", () => {
  it("usa la última observación válida de cada métrica, aunque provenga de filas distintas", () => {
    const report = buildBodyProgressReport({
      weightHistory: [],
      currentWeightKg: null,
      measurements: [
        measurement({ id: "old", measured_on: "2026-08-20", waist_cm: 78, chest_cm: 98 }),
        measurement({ id: "new", measured_on: "2026-09-10", waist_cm: 75 }),
      ],
      period: current,
      referencePeriod: previous,
    });
    expect(report.metrics.find((metric) => metric.key === "body.waist")?.latest?.value).toBe(75);
    expect(report.metrics.find((metric) => metric.key === "body.chest")?.latest?.value).toBe(98);
  });

  it("mantiene izquierda y derecha como series independientes, sin promediarlas", () => {
    const report = buildBodyProgressReport({
      weightHistory: [], currentWeightKg: null,
      measurements: [measurement({ arm_right_cm: 34.8, arm_left_cm: 34.2 })],
      period: current, referencePeriod: previous,
    });
    expect(report.metrics.find((metric) => metric.key === "body.arm_right")?.latest?.value).toBe(34.8);
    expect(report.metrics.find((metric) => metric.key === "body.arm_left")?.latest?.value).toBe(34.2);
    expect(report.sideDifferences[0]).toMatchObject({ kind: "arms", differenceCm: expect.closeTo(0.6) });
    expect(report.metrics.some((metric) => metric.label.includes("promedio"))).toBe(false);
  });

  it("excluye datos sospechosos del estado, cambio y tendencia sin borrarlos", () => {
    const entries = [
      measurement({ id: "valid", measured_on: "2026-08-20", waist_cm: 78 }),
      measurement({ id: "suspect", measured_on: "2026-09-10", waist_cm: 20, quality_status: "suspect", quality_note: "Revisar importación", legacy_import_source: "sheet" }),
    ];
    const report = buildBodyProgressReport({ weightHistory: [], currentWeightKg: null, measurements: entries, period: current, referencePeriod: previous });
    const waist = report.metrics.find((metric) => metric.key === "body.waist")!;
    expect(waist.latest?.value).toBe(78);
    expect(waist.change).toBeNull();
    expect(report.excludedSuspectCount).toBe(1);
    const definition = BODY_PROGRESS_METRICS.find((metric) => metric.key === "body.waist")!;
    expect(bodyMetricObservations({ metric: definition, weightHistory: [], measurements: entries, includeSuspect: true }).at(-1)).toMatchObject({ qualityStatus: "suspect", provenance: "imported", value: 20 });
  });

  it("calcula cambio con puntos irregulares reales y nunca crea días ni ceros", () => {
    const weights: WeightHistoryPoint[] = [
      { id: "a", log_date: "2026-08-16", weight_kg: 67 },
      { id: "b", log_date: "2026-08-28", weight_kg: 66.6 },
      { id: "c", log_date: "2026-09-11", weight_kg: 65.8 },
    ];
    const report = buildBodyProgressReport({ weightHistory: weights, currentWeightKg: 65.8, measurements: [], period: current, referencePeriod: previous });
    const weight = report.metrics.find((metric) => metric.key === "body.weight")!;
    expect(weight.current.map((point) => point.date)).toEqual(["2026-08-16", "2026-08-28", "2026-09-11"]);
    expect(weight.change).toBeCloseTo(-1.2);
    expect(weight.current).toHaveLength(3);
    expect(weight.current.some((point) => point.value === 0)).toBe(false);
  });

  it("distingue estado, cambio puntual y tendencia con muestra suficiente", () => {
    const observation = (id: string, date: string, value: number) => ({ id, date, value, unit: "kg" as const, provenance: "manual" as const, provenanceLabel: "Manual", qualityStatus: "verified" as const, qualityNote: null });
    expect(bodyTrend([observation("a", "2026-09-01", 66)])).toEqual({ direction: "unavailable", confidence: "unavailable" });
    expect(bodyTrend([observation("a", "2026-09-01", 66), observation("b", "2026-09-08", 65)])).toEqual({ direction: "decreased", confidence: "limited" });
    expect(bodyTrend([observation("a", "2026-09-01", 66), observation("b", "2026-09-04", 67), observation("c", "2026-09-08", 65.9)])).toEqual({ direction: "variable", confidence: "supported" });
  });

  it("marca falta de baseline y no compara ausencia contra cero", () => {
    const report = buildBodyProgressReport({
      weightHistory: [{ id: "new", log_date: "2026-09-10", weight_kg: 65.8 }],
      currentWeightKg: 65.8,
      measurements: [], period: current, referencePeriod: previous,
    });
    const weight = report.metrics.find((metric) => metric.key === "body.weight")!;
    expect(weight.change).toBeNull();
    expect(weight.comparisonEligibility).toEqual({ status: "insufficient_data", reason: "previous_period_empty" });
  });

  it("usa fecha semántica y preserva provenance importado", () => {
    const definition = BODY_PROGRESS_METRICS.find((metric) => metric.key === "body.waist")!;
    const observations = bodyMetricObservations({
      metric: definition,
      weightHistory: [],
      measurements: [measurement({ measured_on: "2026-08-31", created_at: "2026-09-11T10:00:00Z", waist_cm: 76, legacy_import_source: "OWNLEVEL legado", legacy_import_id: "12" })],
    });
    expect(observations[0]).toMatchObject({ date: "2026-08-31", provenance: "imported", provenanceLabel: "Importado · OWNLEVEL legado" });
  });

  it("mantiene unidades canónicas incompatibles separadas y agregación corporal no diaria", () => {
    const weight = BODY_PROGRESS_METRICS.find((metric) => metric.key === "body.weight")!;
    const waist = BODY_PROGRESS_METRICS.find((metric) => metric.key === "body.waist")!;
    expect(weight.unit).toBe("kg");
    expect(waist.unit).toBe("cm");
    expect(weight.aggregation).toBe("change");
    expect(waist.aggregation).toBe("change");
    expect(weight.coverageMode).toBe("samples_only");
  });

  it("respeta rangos custom canónicos", () => {
    const period = resolveProgressPeriod({ preset: "custom", from: "2026-08-01", to: "2026-09-01" }, "2026-09-12");
    expect(period.current).toEqual({ start: "2026-08-01", end: "2026-09-01" });
    expect(period.previous).toEqual({ start: "2026-06-30", end: "2026-07-31" });
  });
});
