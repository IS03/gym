import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const reportsPage = source("src/app/(app)/today/reports/page.tsx");
const breakdown = source("src/components/nutrition/nutrition-report-daily-breakdown.tsx");
const periodSelector = source("src/components/nutrition/nutrition-report-period-selector.tsx");

describe("PR 10.7 — jerarquía de reportes", () => {
  it("deja el rango temporal en la card de período y no en el encabezado", () => {
    expect(reportsPage).toContain(">Solo lectura<");
    expect(reportsPage).toContain("formatNutritionReportRange(range.start, range.end)");
    expect(reportsPage).not.toContain("{range.start} al {range.end}");
  });

  it("deja los presets equilibrados y el personalizado en una isla responsive", () => {
    expect(reportsPage).toContain("<NutritionReportPeriodSelector");
    expect(periodSelector).toContain("grid-cols-3");
    expect(periodSelector).toContain("lg:grid-cols-6");
    expect(periodSelector).toContain("ResponsiveDialog");
    expect(periodSelector).toContain("<DateField");
  });

  it("muestra seis opciones nuevas, el rango actual y no deja el formulario visible", () => {
    for (const label of ["7 días", "15 días", "30 días", "3 meses", "1 año", "Personalizado"]) {
      expect(periodSelector).toContain(label);
    }
    expect(periodSelector).not.toContain("14 días");
    expect(periodSelector).not.toContain("Este mes");
    expect(periodSelector).toContain("rangeLabel");
    expect(reportsPage).not.toContain('name="from"');
    expect(reportsPage).not.toContain('name="to"');
  });

  it("inicializa el personalizado desde el rango efectivo y conserva el contrato URL", () => {
    expect(periodSelector).toContain('defaultValue={start}');
    expect(periodSelector).toContain('defaultValue={end}');
    expect(periodSelector).toContain('name="period" value="custom"');
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
