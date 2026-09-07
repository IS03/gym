import { describe, expect, it } from "vitest";

import {
  nutritionReportComparisonMode,
  nutritionReportCurrentPath,
  nutritionReportPath,
  nutritionReportPreviousPath,
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
    expect(nutritionReportPath({ preset: "15", start: "2026-08-24", end: "2026-09-07", comparison: "previous" })).toBe("/today/reports?period=15&compare=previous");
  });

  it("sigue permitiendo reutilizar el selector sin comparación en Pasos", () => {
    expect(nutritionReportPath({ preset: "7", start: "2026-09-01", end: "2026-09-07", basePath: "/today/steps" })).toBe("/today/steps?period=7");
  });
});
