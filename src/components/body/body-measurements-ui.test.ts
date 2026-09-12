import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/body/body-measurements.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/body/page.tsx", "utf8");
const workspace = readFileSync("src/components/body/body-progress-workspace.tsx", "utf8");
const chart = readFileSync("src/components/body/body-progress-chart.tsx", "utf8");
const weight = readFileSync("src/components/body/weight-history.tsx", "utf8");

describe("PR 16 — UI de medidas corporales", () => {
  it("no presenta campos históricos como entradas nuevas", () => {
    expect(source).toContain("EDITABLE_BODY_MEASUREMENT_FIELDS.map");
    expect(source).not.toContain("(legacy)");
  });

  it("conserva valores históricos en el payload de edición", () => {
    expect(source).toContain("for(const field of BODY_MEASUREMENT_FIELDS)");
    expect(source).toContain("setValues(toValues(entry))");
  });

  it("usa el período común y el configurador universal de Comparaciones V2", () => {
    expect(page).toContain("resolveProgressPeriod");
    expect(page).toContain("resolveProgressComparisonReference");
    expect(page).toContain("ComparisonConfigurator");
    expect(page).toContain("BodyProgressPeriodSelector");
  });

  it("prioriza estado, cambios y tendencia antes del historial", () => {
    const state = workspace.indexOf("Estado actual");
    const changes = workspace.indexOf("Qué cambió");
    const trend = workspace.indexOf("Tendencia de peso");
    const measures = workspace.indexOf("Medidas corporales");
    const history = workspace.indexOf("Historial y registros");
    expect(state).toBeGreaterThan(-1);
    expect(state).toBeLessThan(changes);
    expect(changes).toBeLessThan(trend);
    expect(trend).toBeLessThan(measures);
    expect(measures).toBeLessThan(history);
  });

  it("grafica sólo observaciones reales con posición temporal y explicita muestra limitada", () => {
    expect(chart).toContain("xForDate(point.date");
    expect(chart).toContain("Cada punto representa una medición real");
    expect(chart).toContain("tendencia no disponible");
    expect(chart).not.toContain("forward");
  });

  it("integra labels en el borde y mantiene unidades dentro de los campos", () => {
    expect(source).toContain("absolute -top-2");
    expect(source).toContain('unit="cm"');
    expect(weight).toContain('label="Peso" unit="kg"');
    expect(weight).toContain('label="Fecha"');
  });

  it("expone datos sospechosos y provenance sin eliminarlos de su historial", () => {
    expect(source).toContain("Excluida del análisis · Revisar medición");
    expect(source).toContain("Su procedencia se conserva al editar");
    expect(workspace).toContain("Sigue disponible en el historial");
  });
});
