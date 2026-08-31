import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/train/page.tsx", "utf8");

describe("hub operativo de Entrenar", () => {
  it("mantiene la acción de nueva sesión sólo cuando no hay una sesión en curso", () => {
    expect(page).toContain("activeSession ? (");
    expect(page).toContain("Continuar entrenamiento");
    expect(page).toContain("Nueva sesión");
    expect(page).toContain("activeSession={null}");
    expect(page).toContain("href={`/train/session/${activeSession.id}`}");
    expect(page).toContain("activeSession ? (");
    expect(page).toContain("triggerClassName=\"inline-flex h-11 w-full");
    expect(page).not.toContain("Elegí una rutina o empezá una sesión libre.");
  });

  it("prioriza planificación, historial y calendario sin duplicar análisis global", () => {
    expect(page).toContain('href="/train/routines"');
    expect(page).toContain('href="/train/exercises"');
    expect(page).toContain('href="/train/history"');
    expect(page).toContain("TrainingMonthPreview");
    expect(page).not.toContain('href="/train/progress"');
    expect(page).not.toContain('href="/train/body"');
  });

  it("conserva las lecturas paralelas y el contexto autenticado de Train", () => {
    expect(page).toContain("const auth = await requireAuthenticatedRequestContext()");
    expect(page).toContain("const [inProgress, workoutStartRoutines, trainedDays] = await Promise.all([");
    expect(page).toContain("getInProgressSessionForUser(auth)");
    expect(page).toContain("listWorkoutStartRoutines(auth)");
    expect(page).toContain("listTrainingDaysInMonth({ month }, auth)");
  });
});
