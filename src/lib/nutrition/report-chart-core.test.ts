import { describe, expect, it } from "vitest";
import { chartDomain, chartTickIndexes, lineSegments } from "./report-chart-core";

describe("nutrition report chart helpers", () => {
  it("corta la línea en gaps en lugar de dibujarlos como cero", () => {
    const domain = chartDomain([1_800, null, 2_000]);
    const segments = lineSegments([1_800, null, 2_000], domain, 320, 152);
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.map((point) => point.index))).toEqual([[0], [2]]);
  });

  it("mantiene una escala utilizable con un punto, valores iguales y base cero", () => {
    expect(chartDomain([120])).toEqual({ min: 108, max: 132 });
    const withBaseline = chartDomain([-300, 200], true);
    expect(withBaseline.min).toBeLessThanOrEqual(0);
    expect(withBaseline.max).toBeGreaterThanOrEqual(0);
  });

  it.each([1, 7, 14, 30, 366])("reduce etiquetas sin perder primer y último día para %s puntos", (count) => {
    const indexes = chartTickIndexes(count);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(count - 1);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes.length).toBeLessThanOrEqual(5);
  });
});
