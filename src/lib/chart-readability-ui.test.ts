import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const nutrition = source("src/components/nutrition/nutrition-report-charts.tsx");
const training = source("src/components/training/training-insights.tsx");
const exercise = source("src/components/training/exercise-report-view.tsx");
const bodyChart = source("src/components/body/body-progress-chart.tsx");

describe("PR 11.4 — gráficos autoexplicativos", () => {
  it("explicita ejes, unidades y detalle en nutrición", () => {
    expect(nutrition).toContain("Fecha ·");
    expect(nutrition).toContain("chartTickIndexes");
    expect(nutrition).toContain("ChartDetail");
    expect(nutrition).toContain("déficit estimado");
    expect(nutrition).toContain("dateHitBounds");
    expect(nutrition).toContain('height={HEIGHT} fill="transparent"');
  });
  it("etiqueta el promedio semanal y permite seleccionar una semana", () => {
    expect(training).toContain("completedWeeklyAverage");
    expect(training).toContain("Promedio ·");
    expect(training).toContain("semana completa");
    expect(training).toContain("aria-pressed");
    expect(training).toContain("weeklyPlotOffset");
  });
  it("no deja la evolución por ejercicio dependiente sólo de title SVG", () => {
    expect(exercise).toContain("ChartDetail");
    expect(exercise).toContain("chartYAxisTicks");
    expect(exercise).not.toContain("<title>");
  });
  it("hace inspeccionables peso y medidas con fecha y unidad", () => {
    expect(bodyChart).toContain("Cada punto representa una medición real");
    expect(bodyChart).toContain("xForDate");
    expect(bodyChart).toContain("ChartDetail");
    expect(bodyChart).toContain("metric.unit");
  });
});
