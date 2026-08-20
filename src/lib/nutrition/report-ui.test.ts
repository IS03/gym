import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const reportsPage = source("src/app/(app)/today/reports/page.tsx");
const breakdown = source("src/components/nutrition/nutrition-report-daily-breakdown.tsx");

describe("PR 10.7 — jerarquía de reportes", () => {
  it("deja el rango temporal en la card de período y no en el encabezado", () => {
    expect(reportsPage).toContain(">Solo lectura<");
    expect(reportsPage).toContain("formatNutritionReportRange(range.start, range.end)");
    expect(reportsPage).not.toContain("{range.start} al {range.end}");
  });

  it("mantiene el personalizado vertical en mobile y acota los date inputs", () => {
    expect(reportsPage).toContain("grid-cols-1");
    expect(reportsPage).toContain("sm:grid-cols-2");
    expect(reportsPage).toContain("min-w-0 max-w-full");
    expect(reportsPage).toContain("[min-inline-size:0]");
  });

  it("presenta proteína, carbos y grasas en la misma grilla", () => {
    expect(reportsPage).toContain("grid-cols-3");
    expect(reportsPage).toContain(">Proteína<");
    expect(reportsPage).toContain(">Carbos<");
    expect(reportsPage).toContain(">Grasas<");
    expect(reportsPage).toContain("objetivo de proteína");
  });

  it("delega el desglose a una isla local con expansión accesible", () => {
    expect(reportsPage).toContain("<NutritionReportDailyBreakdown");
    expect(breakdown).toContain("getVisibleNutritionReportDays");
    expect(breakdown).toContain("aria-expanded={expanded}");
    expect(breakdown).toContain("/history?date=${day.date}");
  });
});
