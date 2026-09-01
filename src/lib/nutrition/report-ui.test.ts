import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const reportsPage = source("src/app/(app)/today/reports/page.tsx");
const breakdown = source("src/components/nutrition/nutrition-report-daily-breakdown.tsx");
const periodSelector = source("src/components/nutrition/nutrition-report-period-selector.tsx");
const rangePicker = source("src/components/ui/date-range-picker.tsx");

describe("PR 10.7 — jerarquía de reportes", () => {
  it("deja el rango temporal en la card de período y no en el encabezado", () => {
    expect(reportsPage).toContain(">Solo lectura<");
    expect(reportsPage).toContain("formatNutritionReportRange(range.start, range.end)");
    expect(reportsPage).not.toContain("{range.start} al {range.end}");
  });

  it("mantiene los presets en una fila compacta y el personalizado en una isla responsive", () => {
    expect(reportsPage).toContain("<NutritionReportPeriodSelector");
    expect(periodSelector).toContain("overflow-x-auto");
    expect(periodSelector).toContain("shrink-0");
    expect(periodSelector).toContain('aria-label="Período del reporte"');
    expect(periodSelector).toContain("ResponsiveDialog");
    expect(periodSelector).toContain("<DateRangePicker");
    expect(periodSelector).not.toContain("<DateField");
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
    expect(periodSelector).toContain('useState<DateRangeValue>({ start, end })');
    expect(periodSelector).toContain('value={customRange}');
    expect(periodSelector).toContain('NUTRITION_REPORT_MAX_DAYS');
    expect(periodSelector).toContain('disabled={!customRange.start || !customRange.end}');
    expect(periodSelector).toContain('basePath = "/today/reports"');
    expect(periodSelector).toContain("useTransition");
    expect(periodSelector).toContain("router.push");
    expect(periodSelector).toContain("URLSearchParams");
    expect(periodSelector).toContain("Actualizando…");
    expect(periodSelector).toContain('name="period" value="custom"');
    expect(rangePicker).toContain('name={fromName}');
    expect(rangePicker).toContain('name={toName}');
    expect(periodSelector).toContain('name="period" value="custom"');
  });

  it("permite reutilizar los presets y el rango personalizado para Pasos", () => {
    const stepsPage = source("src/app/(app)/today/steps/page.tsx");
    expect(stepsPage).toContain('basePath="/today/steps"');
    expect(periodSelector).toContain('navigate(`${basePath}?period=${option.period}`)');
  });

  it("preserva proteína, carbos y grasas dentro del resumen compacto", () => {
    expect(reportsPage).toContain('label="Proteína promedio"');
    expect(reportsPage).toContain('label="Carbos"');
    expect(reportsPage).toContain('label="Grasas"');
    expect(reportsPage).toContain("summary.protein.hitDays");
  });

  it("delega el desglose a una isla local con expansión accesible", () => {
    expect(reportsPage).toContain("<NutritionReportDailyBreakdown");
    expect(breakdown).toContain("getVisibleNutritionReportDays");
    expect(breakdown).toContain("aria-expanded={expanded}");
    expect(breakdown).toContain("/history?date=${day.date}");
    expect(breakdown).not.toContain("<Card");
  });

  it("concentra tendencias en una única superficie y conserva sus cinco métricas", () => {
    const charts = source("src/components/nutrition/nutrition-report-charts.tsx");
    expect(charts).toContain('role="tablist"');
    for (const label of ["Energía", "Balance", "Proteína", "Agua", "Pasos"]) {
      expect(charts).toContain(label);
    }
    expect(charts).toContain("bucketNutritionChartDays");
    expect(charts).toContain('touchAction: "pan-y"');
  });
});
