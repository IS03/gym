import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const configurator = source("src/components/progress/comparison-configurator.tsx");
const workspace = source("src/components/progress/comparison-workspace.tsx");
const evolution = source("src/components/progress/comparison-evolution.tsx");
const summary = source("src/components/progress/comparison-summary.tsx");

describe("Comparaciones V2 — componentes compartidos", () => {
  it("configura previous, otro período y objetivo con métricas contextuales", () => {
    expect(configurator).toContain("ResponsiveDialog");
    expect(configurator).toContain('value: "previous_period"');
    expect(configurator).toContain('value: "other_period"');
    expect(configurator).toContain('value: "goal"');
    expect(configurator).toContain("metrics.map");
    expect(configurator).toContain("metric.supportsGoal");
    expect(configurator).toContain("DateRangePicker");
    expect(configurator).not.toContain("localStorage");
  });

  it("mantiene una sola configuración y cambia vista o métrica sin refetch", () => {
    expect(workspace).toContain("Qué cambió");
    expect(workspace).toContain("Resumen");
    expect(workspace).toContain("Evolución");
    expect(workspace).toContain("window.history.pushState");
    expect(evolution).toContain("onMetricChange");
    expect(evolution).toContain('strokeDasharray="5 4"');
    expect(evolution).toContain('bucket === "day" ? "D" : bucket === "week" ? "S" : "M"');
  });

  it("expone cobertura e insuficiencia sin semáforos de bueno o malo", () => {
    expect(summary).toContain("comparisonCoverageLabel");
    expect(summary).toContain("comparisonInsufficientMessage");
    expect(summary).not.toContain("text-emerald");
    expect(summary).not.toContain("text-destructive");
  });
});
