import { describe, expect, it } from "vitest";

import {
  nutritionReportComparisonMode,
  nutritionReportCurrentPath,
  nutritionReportPath,
  nutritionReportPreviousPath,
  withDefaultNutritionComparison,
} from "./report-navigation";

describe("nutrition report comparison navigation", () => {
  it("activa únicamente compare=previous", () => {
    expect(nutritionReportComparisonMode("previous")).toBe("previous");
    expect(nutritionReportComparisonMode("periods")).toBeNull();
    expect(nutritionReportComparisonMode(undefined)).toBeNull();
  });

  it("alterna comparación sin perder preset ni rango personalizado", () => {
    const custom = { preset: "custom" as const, start: "2026-08-20", end: "2026-09-07", error: null };
    expect(nutritionReportPreviousPath(custom)).toBe("/today/reports?period=custom&from=2026-08-20&to=2026-09-07&compare=previous");
    expect(nutritionReportCurrentPath(custom)).toBe("/today/reports?period=custom&from=2026-08-20&to=2026-09-07");
    expect(nutritionReportPath({ preset: "14", start: "2026-08-25", end: "2026-09-07", comparison: "previous" })).toBe("/today/reports?period=14&compare=previous");
    expect(nutritionReportPath({ preset: "14", start: "2026-08-25", end: "2026-09-07", basePath: "/progress/metrics", query: { metric: "metric-1" } })).toBe("/progress/metrics?period=14&metric=metric-1");
  });

  it("sigue permitiendo reutilizar el selector sin comparación en Pasos", () => {
    expect(nutritionReportPath({ preset: "7", start: "2026-09-01", end: "2026-09-07", basePath: "/today/steps" })).toBe("/today/steps?period=7");
  });

  it("usa el período anterior equivalente como referencia inicial de Nutrición V2", () => {
    const base = {
      referenceType: null,
      referencePreset: null,
      referenceFrom: null,
      referenceTo: null,
      selectedMetricKeys: [],
      activeMetricKey: null,
      initialView: "insights" as const,
    };
    expect(withDefaultNutritionComparison(base)).toMatchObject({ referenceType: "previous_period" });
    expect(withDefaultNutritionComparison({ ...base, referenceType: "goal" })).toMatchObject({ referenceType: "goal" });
  });
});
