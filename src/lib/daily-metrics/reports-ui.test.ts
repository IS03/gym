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
  });

  it("expone la ruta de métricas desde Progreso y preserva selector, métrica y comparación en URL", () => {
    expect(progress).toContain('href="/progress/metrics"');
    expect(page).toContain('basePath="/progress/metrics"');
    expect(page).toContain("query={query}");
    expect(report).toContain('next.set("metric", metricId)');
    expect(report).toContain("Vs anterior");
  });

  it("presenta promedio, cobertura, extremos, tendencia, objetivo actual y un gráfico principal", () => {
    for (const label of ["Promedio", "Días registrados", "Mínimo", "Máximo", "Tendencia del período", "Objetivo actual"] ) {
      expect(report).toContain(label);
    }
    expect(report).toContain("Sin dato no cuenta como cero");
    expect(report).toContain("referencia, no objetivo histórico");
    expect(report.match(/<MetricChart/g)).toHaveLength(1);
  });

  it("mantiene Nutrición libre de Agua, Pasos, Trabajo y Entrenamiento legacy", () => {
    const nutritionUi = `${nutritionPage}\n${nutritionCharts}\n${nutritionBreakdown}`;
    for (const legacy of ["summary.hydration", "summary.activity", 'label="Agua"', 'label="Pasos"', "Trabajo:", "Entrenamiento:"]) {
      expect(nutritionUi).not.toContain(legacy);
    }
  });
});
