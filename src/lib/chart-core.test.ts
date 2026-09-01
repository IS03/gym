import { describe, expect, it } from "vitest";
import { chartDomain, chartTickIndexes, chartYAxisTicks, fittedNonNegativeChartDomain, formatChartValue, lineSegments, nonNegativeChartDomain } from "./chart-core";

describe("chart display helpers", () => {
  it("creates a small, ordered Y scale for positive, mixed and constant data", () => {
    expect(chartYAxisTicks(chartDomain([10, 30]), 4)).toHaveLength(4);
    const mixed = chartDomain([-300, 200], true);
    expect(mixed.min).toBeLessThanOrEqual(0);
    expect(mixed.max).toBeGreaterThanOrEqual(0);
    const constant = chartDomain([64.8]);
    expect(constant.min).toBeLessThan(64.8);
    expect(constant.max).toBeGreaterThan(64.8);
  });

  it("formats units coherently for chart labels", () => {
    expect(formatChartValue(2074, "kcal")).toBe("2.074 kcal");
    expect(formatChartValue(64.8, "kg")).toBe("64,8 kg");
    expect(formatChartValue(2.25, "L")).toBe("2,25 L");
    expect(formatChartValue(9000, "pasos")).toBe("9.000 pasos");
    expect(formatChartValue(-0, "kcal")).toBe("0 kcal");
  });

  it("samples long X axes and preserves null gaps instead of turning them into zero", () => {
    expect(chartTickIndexes(366)).toEqual([0, 91, 183, 274, 365]);
    const domain = chartDomain([10, null, 30]);
    expect(lineSegments([10, null, 30], domain, 320, 152)).toHaveLength(2);
  });

  it("keeps domains for inherently non-negative metrics on or above zero", () => {
    expect(nonNegativeChartDomain([10, 30])).toMatchObject({ min: 0 });
    expect(nonNegativeChartDomain([0, 0])).toEqual({ min: 0, max: 1 });
    expect(nonNegativeChartDomain([-20, 4])).toMatchObject({ min: 0 });
  });

  it("fits an individual weight scale around observed weights without becoming negative", () => {
    expect(fittedNonNegativeChartDomain([80, 90])).toEqual({ min: 75, max: 95 });
    expect(fittedNonNegativeChartDomain([0.5])).toMatchObject({ min: 0 });
  });
});
