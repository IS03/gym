import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const data = source("src/lib/daily-metrics/reports.ts");
const report = source("src/components/daily-metrics/daily-metric-report.tsx");
const page = source("src/app/(app)/progress/metrics/page.tsx");
const progress = source("src/app/(app)/progress/page.tsx");
const nutritionPage = source("src/app/(app)/today/reports/page.tsx");
const nutritionCharts = source("src/components/nutrition/nutrition-report-charts.tsx");
const nutritionBreakdown = source("src/components/nutrition/nutrition-report-daily-breakdown.tsx");

describe("PR74 — integración de Progreso real", () => {
  it("consulta definitions y values agrupados desde las tablas canónicas", () => {
    expect(data).toContain('.from("user_metrics")');
    expect(data).toContain('.from("daily_metric_values")');
    expect(data).toContain("Promise.all");
    expect(data).not.toContain('.from("day_logs")');
    expect(data).not.toContain("metric.name ===");
    expect(data).toContain("adaptDailyMetricDefinition");
    expect(data).toContain("buildProgressComparison");
  });

  it("expone la ruta de métricas desde Progreso y preserva selector, métrica y comparación en URL", () => {
    expect(progress).toContain('href="/progress/metrics"');
    expect(page).toContain('basePath="/progress/metrics"');
    expect(page).toContain("query={query}");
    expect(report).toContain('next.set("metric", metricIdValue)');
    expect(report).toContain("Vs anterior");
    expect(page).toContain("<ComparisonConfigurator");
    expect(report).toContain("defaultComparison");
  });

  it("presenta la jerarquía V2 dinámica, cobertura, objetivo descriptivo y un gráfico por escala", () => {
    for (const label of ["Cómo venís", "Qué cambió", "Consistencia", "Objetivos", "Evolución", "Gestionar métricas", "Registros recientes"] ) {
      expect(report).toContain(label);
    }
    expect(report).toContain("los huecos no se convierten en cero");
    expect(report).toContain("referencia sin dirección configurada");
    expect(report).toContain("visibleResults.map");
    expect(report).not.toContain('metric.name === "Pasos"');
    expect(report).not.toContain('metric.name === "Sueño"');
  });

  it("mantiene el día en curso fuera del promedio elegible y no inventa dirección del objetivo", () => {
    expect(data).toContain("excludeInProgressDay");
    expect(data).toContain("defaultComparison");
    expect(source("src/lib/progress/analytics/catalog.ts")).toContain('rule: "reference"');
  });

  it("mantiene Nutrición libre de Agua, Pasos, Trabajo y Entrenamiento legacy", () => {
    const nutritionUi = `${nutritionPage}\n${nutritionCharts}\n${nutritionBreakdown}`;
    for (const legacy of ["summary.hydration", "summary.activity", 'label="Agua"', 'label="Pasos"', "Trabajo:", "Entrenamiento:"]) {
      expect(nutritionUi).not.toContain(legacy);
    }
  });
});
