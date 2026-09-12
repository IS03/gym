import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync("src/components/training/training-analysis-workspace.tsx", "utf8");
const muscles = readFileSync("src/components/training/training-muscles-v2.tsx", "utf8");
const report = readFileSync("src/components/training/exercise-report-view.tsx", "utf8");
const comparison = readFileSync("src/components/training/training-comparison-workspace.tsx", "utf8");

describe("integrated temporal comparison UI", () => {
  it("keeps self-comparison inside Evolución instead of a separate comparison block", () => {
    expect(muscles).toContain("function MuscleEvolution");
    expect(muscles).toContain("Vs anterior");
    expect(muscles).toContain("ComparisonEvolution");
    expect(workspace).not.toContain("function ComparisonSection");
    expect(workspace).not.toContain("function WeeklyComparison");
    expect(workspace).not.toContain("Semana en curso");
    expect(report).toContain("<EvolutionMode");
    expect(report).toContain("<TrainingSelfComparisonContent");
    expect(report).not.toContain('aria-label="Opciones de comparación"');
  });

  it("uses the compact Actual/Anterior detail and avoids a native focus outline on touch targets", () => {
    expect(comparison).toContain('value: `${metricValue(selected.a[metric], metric)} · ${dateRange(selected.rangeA)}`');
    expect(comparison).toContain('value: `${metricValue(selected.b[metric], metric)} · ${dateRange(selected.rangeB)}`');
    expect(comparison).toContain('className="outline-none focus:outline-none"');
    expect(report).toContain('className="outline-none focus:outline-none"');
  });
});
