import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const nutrition = source("src/components/nutrition/nutrition-report-charts.tsx");
const training = source("src/components/training/training-insights.tsx");
const exercise = source("src/components/training/exercise-report-view.tsx");
const weight = source("src/components/body/weight-history.tsx");
const measurements = source("src/components/body/body-measurements.tsx");

describe("PR 11.4 — gráficos autoexplicativos", () => {
  it("explicita ejes, unidades y detalle en nutrición", () => {
    expect(nutrition).toContain("Fecha ·");
    expect(nutrition).toContain("chartTickIndexes");
    expect(nutrition).toContain("ChartDetail");
    expect(nutrition).toContain("déficit estimado");
  });
  it("etiqueta el promedio semanal y permite seleccionar una semana", () => {
    expect(training).toContain("completedWeeklyAverage");
    expect(training).toContain("Promedio ·");
    expect(training).toContain("semana completa");
    expect(training).toContain("aria-pressed");
  });
  it("no deja la evolución por ejercicio dependiente sólo de title SVG", () => {
    expect(exercise).toContain("ChartDetail");
    expect(exercise).toContain("chartYAxisTicks");
    expect(exercise).not.toContain("<title>");
  });
  it("hace inspeccionables peso y medidas con fecha y unidad", () => {
    expect(weight).toContain("Fecha · Peso (kg)");
    expect(weight).toContain("ChartDetail");
    expect(measurements).toContain("(cm)");
    expect(measurements).toContain("chartTickIndexes");
    expect(measurements).toContain("ChartDetail");
  });
});
