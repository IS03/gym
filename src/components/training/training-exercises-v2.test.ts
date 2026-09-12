import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = readFileSync("src/components/training/training-exercises-v2.tsx", "utf8");
const report = readFileSync("src/components/training/exercise-report-view.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/progress/page.tsx", "utf8");
const detailPage = readFileSync("src/app/(app)/train/history/[exerciseId]/page.tsx", "utf8");

describe("Entrenamiento V2 — Ejercicios UI", () => {
  it("keeps exploration compact and navigates with period and filters", () => {
    expect(list).toContain("Buscar ejercicio");
    expect(list).toContain("Todas las rutinas");
    expect(list).toContain("Todos los músculos");
    expect(list).toContain("Mejoraron");
    expect(list).toContain("trainingAnalysisExercisePath(exercise.id, exerciseState)");
    expect(page).toContain("getTrainingExercisesAnalysis");
  });

  it("puts performance before findings, evolution, marks, load, next session and history", () => {
    const rendered = report.slice(report.indexOf("export function ExerciseReportView"));
    expect(rendered.indexOf("<PerformanceSection")).toBeLessThan(rendered.indexOf("<FindingsSection"));
    expect(rendered.indexOf("<FindingsSection")).toBeLessThan(rendered.indexOf("exercise-evolution-title"));
    expect(rendered.indexOf("exercise-evolution-title")).toBeLessThan(rendered.indexOf("<MarksSection"));
    expect(rendered.indexOf("<MarksSection")).toBeLessThan(rendered.indexOf("<LoadSection"));
    expect(rendered.indexOf("<LoadSection")).toBeLessThan(rendered.indexOf("<NextSessionSection"));
    expect(rendered.indexOf("<NextSessionSection")).toBeLessThan(rendered.indexOf("Historial de sesiones"));
  });

  it("uses canonical performance, weight-mode labels and an explicit no-baseline state", () => {
    expect(detailPage).toContain("analytics={detail}");
    expect(report).toContain("mismo ejercicio y weight_mode");
    expect(report).toContain('isMode(weightMode, "tiempo (segundos)")');
    expect(report).toContain('isMode(weightMode, "lingotes (no kg)")');
    expect(report).toContain("No hay suficiente historial para comparar este período.");
    expect(report).toContain("<ComparisonSummary report={analytics.loadComparison}");
  });

  it("preserves session drill-down and keeps cross-exercise comparison secondary", () => {
    expect(report).toContain("Ver sesión completa");
    expect(report).toContain("Comparar con otro ejercicio");
    expect(report).toContain("Otras comparaciones");
  });
});
