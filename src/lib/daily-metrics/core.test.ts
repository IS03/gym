import { describe, expect, it } from "vitest";
import {
  SYSTEM_METRIC_DEFAULTS,
  formatMetricTarget,
  moveMetric,
  normalizeMetricName,
  normalizeMetricUnit,
  parseDailyMetricValue,
  parseMetricTarget,
} from "./core";

describe("PR72 — núcleo de métricas diarias", () => {
  it("define identidades estables para Pasos, Agua, Mate y Sueño", () => {
    expect(SYSTEM_METRIC_DEFAULTS.map((metric) => metric.systemKey)).toEqual([
      "steps",
      "water",
      "mate",
      "sleep",
    ]);
    expect(SYSTEM_METRIC_DEFAULTS.find((metric) => metric.systemKey === "sleep")).toMatchObject({
      valueType: "duration",
      unit: "min",
      target: 480,
    });
  });

  it("acepta coma y punto en decimales y preserva null distinto de cero", () => {
    expect(parseDailyMetricValue("2,5", "decimal")).toBe(2.5);
    expect(parseDailyMetricValue("2.5", "decimal")).toBe(2.5);
    expect(parseDailyMetricValue("", "decimal")).toBeNull();
    expect(parseDailyMetricValue("0", "decimal")).toBe(0);
    expect(() => parseDailyMetricValue("2;5", "decimal")).toThrow("número válido");
  });

  it("protege los tipos enteros y representa duración en minutos", () => {
    expect(parseDailyMetricValue("7535", "integer")).toBe(7535);
    expect(parseDailyMetricValue("455", "duration")).toBe(455);
    expect(() => parseDailyMetricValue("7,5", "duration")).toThrow("entero");
    expect(parseMetricTarget("480", "duration")).toBe(480);
    expect(formatMetricTarget({ target_value: 455, value_type: "duration", unit: "min" })).toBe("Objetivo 7 h 35 min");
    expect(formatMetricTarget({ target_value: 0, value_type: "duration", unit: "min" })).toBe("Objetivo 0 min");
  });

  it("valida nombre, unidad y objetivo sin imponer un objetivo", () => {
    expect(normalizeMetricName("  Bicicleta  ")).toBe("Bicicleta");
    expect(normalizeMetricUnit(" km ", "decimal")).toBe("km");
    expect(normalizeMetricUnit("horas", "duration")).toBe("min");
    expect(parseMetricTarget("", "decimal")).toBeNull();
    expect(parseMetricTarget("0", "decimal")).toBe(0);
    expect(() => normalizeMetricName(" ")).toThrow("obligatorio");
    expect(() => parseMetricTarget("-1", "decimal")).toThrow("número válido");
  });

  it("reordena de forma estable y no mueve fuera de límites", () => {
    const metrics = ["steps", "water", "mate", "sleep"];
    expect(moveMetric(metrics, 2, -1)).toEqual(["steps", "mate", "water", "sleep"]);
    expect(moveMetric(metrics, 0, -1)).toBe(metrics);
    expect(moveMetric(metrics, 3, 1)).toBe(metrics);
  });
});
