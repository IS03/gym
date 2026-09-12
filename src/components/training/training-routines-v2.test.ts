import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routines = readFileSync("src/components/training/training-routines-v2.tsx", "utf8");
const workspace = readFileSync("src/components/training/training-analysis-workspace.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/progress/page.tsx", "utf8");
const robust = readFileSync("src/lib/phase2/training-robust.ts", "utf8");

describe("Entrenamiento V2 — Rutinas", () => {
  it("renders the approved detail hierarchy with performance before load", () => {
    const detail = routines.slice(routines.indexOf("function RoutineDetail"));
    expect(detail.indexOf("<Performance")).toBeLessThan(detail.indexOf("<Findings"));
    expect(detail.indexOf("<Findings")).toBeLessThan(detail.indexOf("<RoutineLoad"));
    expect(detail.indexOf("<RoutineLoad")).toBeLessThan(detail.indexOf("<RoutineEvolution"));
    expect(detail.indexOf("<RoutineEvolution")).toBeLessThan(detail.indexOf("<MuscleDistribution"));
    expect(detail.indexOf("<MuscleDistribution")).toBeLessThan(detail.indexOf("<RoutineExercises"));
  });

  it("shows historical routines and only comparable exercises in the progress signal", () => {
    expect(routines).toContain("Histórica");
    expect(routines).toContain("comparables mejoraron");
    expect(routines).toContain("fuera del denominador");
    expect(routines).toContain("Sin suficiente comparación");
  });

  it("keeps compact period/custom comparison controls and current-vs-reference evolution", () => {
    expect(workspace).toContain("TrainingProgressPeriodSelector");
    expect(routines).toContain("ComparisonConfigurator");
    expect(routines).toContain("ComparisonEvolution");
    expect(routines).toContain('setMode("current")');
    expect(routines).toContain('setMode("comparison")');
    expect(page).toContain("getTrainingRoutinesAnalysis");
  });

  it("preserves exercise navigation and keeps cross-routine comparison secondary", () => {
    expect(routines).toContain("trainingAnalysisExercisePath");
    expect(routines).toContain("Comparar con otra rutina");
    expect(routines).toContain("no decide qué rutina progresó más");
  });

  it("uses one grouped historical read model instead of per-routine queries", () => {
    const loader = robust.slice(robust.indexOf("export async function getTrainingRoutinesAnalysis"));
    expect(loader).toContain("loadCompletedTrainingData()");
    expect(loader).toContain("buildTrainingRoutinesAnalytics");
    expect(loader).not.toContain("for (const routine");
  });
});
