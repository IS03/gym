import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const muscles = readFileSync("src/components/training/training-muscles-v2.tsx", "utf8");
const workspace = readFileSync("src/components/training/training-analysis-workspace.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/progress/page.tsx", "utf8");
const robust = readFileSync("src/lib/phase2/training-robust.ts", "utf8");

describe("Entrenamiento V2 — Músculos", () => {
  it("renders the approved group detail hierarchy with performance before load", () => {
    const detail = muscles.slice(muscles.indexOf("function MuscleDetail"));
    expect(detail.indexOf("<Performance")).toBeLessThan(detail.indexOf("<Findings"));
    expect(detail.indexOf("<Findings")).toBeLessThan(detail.indexOf("<MuscleLoad"));
    expect(detail.indexOf("<MuscleLoad")).toBeLessThan(detail.indexOf("<MuscleEvolution"));
    expect(detail.indexOf("<MuscleEvolution")).toBeLessThan(detail.indexOf("<Subzones"));
    expect(detail.indexOf("<Subzones")).toBeLessThan(detail.indexOf("<ExerciseRows"));
  });

  it("uses broad groups in the list and nests real subzones in detail", () => {
    expect(muscles).toContain("Se muestran sólo grupos amplios");
    expect(muscles).toContain("Subzonas");
    expect(muscles).toContain("muscleZoneKey: zone.key");
    expect(muscles).toContain("ejercicio; la distribución representa series");
  });

  it("keeps the compact canonical period and A/B evolution controls", () => {
    expect(workspace).toContain('view="muscles"');
    expect(workspace).toContain("TrainingProgressPeriodSelector");
    expect(muscles).toContain("ComparisonConfigurator");
    expect(muscles).toContain("ComparisonEvolution");
    expect(muscles).toContain('setMode("current")');
    expect(muscles).toContain('setMode("comparison")');
    expect(page).toContain("getTrainingMusclesAnalysis");
  });

  it("preserves exercise navigation and keeps cross-muscle comparison secondary", () => {
    expect(muscles).toContain("trainingAnalysisExercisePath");
    expect(muscles).toContain("Comparar con otro músculo");
    expect(muscles).toContain("no decide qué músculo progresó más");
  });

  it("uses one grouped read model instead of per-muscle or per-zone queries", () => {
    const loader = robust.slice(robust.indexOf("export async function getTrainingMusclesAnalysis"));
    expect(loader).toContain("loadCompletedTrainingData()");
    expect(loader).toContain("buildTrainingMusclesAnalytics");
    expect(loader).not.toContain("for (const muscle");
    expect(loader).not.toContain("for (const zone");
  });
});
