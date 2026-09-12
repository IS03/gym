import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const general = readFileSync("src/components/training/training-general-v2.tsx", "utf8");
const periodSelector = readFileSync("src/components/training/training-progress-period-selector.tsx", "utf8");
const workspace = readFileSync("src/components/training/training-analysis-workspace.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/progress/page.tsx", "utf8");

describe("Entrenamiento V2 — General", () => {
  it("puts performance before findings, exercise detail, load and evolution", () => {
    const rendered = general.slice(general.indexOf("export function TrainingGeneralV2"));
    expect(rendered.indexOf("<PerformanceOverview")).toBeLessThan(rendered.indexOf("<Findings"));
    expect(rendered.indexOf("<Findings")).toBeLessThan(rendered.indexOf("<ExercisePerformanceList"));
    expect(rendered.indexOf("<ExercisePerformanceList")).toBeLessThan(rendered.indexOf("<LoadSummary"));
    expect(rendered.indexOf("<LoadSummary")).toBeLessThan(rendered.indexOf("<LoadEvolution"));
    expect(rendered.indexOf("<LoadEvolution")).toBeLessThan(rendered.indexOf("<Feelings"));
    expect(rendered.indexOf("<Feelings")).toBeLessThan(rendered.indexOf("<Explore"));
  });

  it("keeps the canonical A/B controls, a compact period trigger and client-side metric switching", () => {
    expect(general).toContain("ComparisonConfigurator");
    expect(general).toContain("ComparisonEvolution");
    expect(general).toContain('viewParam="comparisonView"');
    expect(general).toContain('setMode("current")');
    expect(general).toContain('setMode("comparison")');
    expect(general).toContain("TrainingProgressPeriodSelector");
    expect(periodSelector).toContain("DateRangePicker");
    expect(periodSelector).toContain('next.set("period", "custom")');
    expect(workspace).toContain('view === "muscles" || view === "exercises" ? <PeriodSelector');
    expect(page).toContain("resolveProgressComparisonReference");
  });

  it("links every exercise to its existing report and exposes insufficient-data wording", () => {
    expect(general).toContain("trainingAnalysisExercisePath(item.exerciseId, state)");
    expect(general).toContain("Sin datos suficientes");
    expect(general).toContain("fuera del denominador");
    expect(general).toContain("Sin historial comparable");
  });

  it("keeps session feedback conditional and the other tabs navigable", () => {
    expect(general).toContain("if (!analytics.feelings.length) return null");
    expect(general).toContain('view: "routines" as const');
    expect(general).toContain('view: "muscles" as const');
    expect(general).toContain('view: "exercises" as const');
  });
});
