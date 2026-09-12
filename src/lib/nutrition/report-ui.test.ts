import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const reportsPage = source("src/app/(app)/today/reports/page.tsx");
const overview = source("src/components/nutrition/nutrition-report-overview.tsx");
const evolution = source("src/components/nutrition/nutrition-report-evolution-v2.tsx");
const breakdown = source("src/components/nutrition/nutrition-report-daily-breakdown.tsx");
const periodSelector = source("src/components/nutrition/nutrition-report-period-selector.tsx");
const sharedEvolution = source("src/components/progress/comparison-evolution.tsx");

describe("Progress V2 — reporte de nutrición", () => {
  it("ordena interpretación, energía y macros antes del detalle diario", () => {
    const findings = reportsPage.indexOf("<NutritionFindings");
    const energy = reportsPage.indexOf("<NutritionEnergySummary");
    const macros = reportsPage.indexOf("<NutritionMacroSummary");
    const chart = reportsPage.indexOf("<NutritionReportEvolutionV2");
    const breakdownIndex = reportsPage.indexOf("<NutritionReportDailyBreakdown");

    expect(reportsPage).toContain("Progreso de nutrición");
    expect(findings).toBeGreaterThan(0);
    expect(findings).toBeLessThan(energy);
    expect(energy).toBeLessThan(macros);
    expect(macros).toBeLessThan(chart);
    expect(chart).toBeLessThan(breakdownIndex);
  });

  it("usa un selector compacto con presets y rango personalizado canónico", () => {
    expect(reportsPage).toContain("compact");
    expect(periodSelector).toContain("CalendarRange");
    expect(periodSelector).toContain("ResponsiveDialog");
    expect(periodSelector).toContain("previousNutritionReportRange");
    expect(periodSelector).toContain("DateRangePicker");
    expect(periodSelector).toContain("NUTRITION_REPORT_MAX_DAYS");
    for (const label of ["Semana", "2 semanas", "Mes", "3 meses", "6 meses", "1 año"]) {
      expect(periodSelector).toContain(label);
    }
  });

  it("hace anterior equivalente la comparación por defecto y conserva el configurador universal", () => {
    expect(reportsPage).toContain("withDefaultNutritionComparison");
    expect(reportsPage).toContain("getNutritionReportWithProgressComparison");
    expect(reportsPage).toContain("<ComparisonConfigurator");
    expect(reportsPage).toContain('triggerLabel="Comparar"');
    expect(reportsPage).not.toContain("<ComparisonWorkspace");
  });

  it("separa consumo, objetivo, gasto y balance con la fórmula correcta", () => {
    for (const label of ["Consumo promedio", "Objetivo del período", "Gasto estimado", "Balance promedio", "Balance acumulado"]) {
      expect(overview).toContain(label);
    }
    expect(overview).toContain("Balance energético = consumo − gasto estimado");
    expect(overview).toContain("No es la diferencia contra el objetivo calórico");
    expect(overview).toContain("Referencia histórica registrada");
  });

  it("presenta macros como filas compactas y sólo aplica el objetivo histórico existente a proteína", () => {
    for (const label of ["Proteína", "Carbohidratos", "Grasas"]) expect(overview).toContain(label);
    expect(overview).toContain("summary.protein.hitDays");
    expect(overview).not.toContain("Objetivo de carbohidratos");
    expect(overview).not.toContain("Objetivo de grasas");
  });

  it("reutiliza la evolución A/B, una métrica por eje y marca el cero semántico del balance", () => {
    expect(evolution).toContain("ComparisonEvolution");
    expect(evolution).toContain("Una métrica por vez");
    expect(evolution).toContain("Vs anterior");
    expect(evolution).toContain('activeMetric === "nutrition.energy_balance"');
    expect(sharedEvolution).toContain("hasSemanticZero");
  });

  it("expone cobertura y explica que hoy en curso no altera los promedios", () => {
    expect(overview).toContain("Consistencia y cobertura");
    expect(overview).toContain("Los días sin dato no se convierten en cero");
    expect(overview).toContain("Hoy figura como “En curso”");
    expect(breakdown).toContain("En curso");
  });

  it("mantiene días destacados y desglose diario como drill-down final", () => {
    expect(reportsPage).toContain("<NutritionHighlightedDays");
    expect(overview).toContain("Días que explican el período");
    expect(breakdown).toContain("getVisibleNutritionReportDays");
    expect(breakdown).toContain("aria-expanded={expanded}");
    expect(breakdown).toContain("/history?date=${day.date}");
  });
});
