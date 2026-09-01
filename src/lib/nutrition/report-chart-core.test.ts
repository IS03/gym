import { describe, expect, it } from "vitest";
import {
  averageBucketValue,
  balanceChartTicks,
  bucketNutritionChartDays,
  chartBandGeometry,
  chartDomain,
  chartTickIndexes,
  lineSegments,
} from "./report-chart-core";

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

  it("mantiene el dominio de métricas no negativas desde cero", () => {
    for (const values of [[748, 1_900], [0, 8_100], [53.2, 130], [1, 2]]) {
      const domain = chartDomain(values, { nonNegative: true });
      expect(domain.min).toBe(0);
      expect(domain.max).toBeGreaterThanOrEqual(Math.max(...values));
    }
  });

  it("conserva el cero y ambos lados para balance", () => {
    const domain = chartDomain([-300, 200], true);
    expect(domain.min).toBeLessThanOrEqual(0);
    expect(domain.max).toBeGreaterThanOrEqual(0);
  });

  it.each([
    [-500, 1_000],
    [-1_000, -100],
    [100, 1_000],
    [0, 0],
  ])("incluye un tick cero explícito en balance para el dominio %s a %s", (min, max) => {
    expect(balanceChartTicks({ min, max })).toContain(0);
  });

  it.each([1, 2, 7, 14, 31])("mantiene cada banda de barras dentro del plot para %s buckets", (count) => {
    const width = 320;
    const left = 48;
    const right = 12;
    const first = chartBandGeometry(0, count, width, left, right);
    const last = chartBandGeometry(count - 1, count, width, left, right);

    expect(first.start).toBe(left);
    expect(first.center).toBeGreaterThan(left);
    expect(last.end).toBe(width - right);
    expect(last.center).toBeLessThan(width - right);
    expect(first.width).toBe(last.width);
  });

  it("crea hit areas contiguas, sin huecos ni solapamientos", () => {
    const bands = Array.from({ length: 7 }, (_, index) => chartBandGeometry(index, 7, 320, 48, 12));
    for (let index = 1; index < bands.length; index += 1) {
      expect(bands[index]!.start).toBe(bands[index - 1]!.end);
    }
  });

  it("usa días para rangos cortos, semanas para rangos medios y meses aproximados para un año", () => {
    const days = (count: number) => Array.from({ length: count }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      isToday: index === count - 1,
      value: index + 1,
    }));
    expect(bucketNutritionChartDays(days(7))).toHaveLength(7);
    expect(bucketNutritionChartDays(days(90))).toHaveLength(Math.ceil(90 / 7));
    expect(bucketNutritionChartDays(days(366))).toHaveLength(Math.ceil(366 / 31));
  });

  it("calcula el promedio diario del bucket sin convertir huecos en cero", () => {
    const bucket = bucketNutritionChartDays(Array.from({ length: 32 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      isToday: false,
      value: index === 0 ? 1_800 : index === 1 ? null : index === 2 ? 2_000 : null,
    })))[0]!;
    expect(averageBucketValue(bucket, (day) => day.value)).toBe(1_900);
  });
});
