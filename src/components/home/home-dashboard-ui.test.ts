import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/home/page.tsx", "utf8");
const dashboard = readFileSync(
  "src/components/home/home-dashboard.tsx",
  "utf8",
);
const training = readFileSync("src/lib/phase2/training-robust.ts", "utf8");

describe("Home V2", () => {
  it("keeps the empty and active training actions on the existing flows", () => {
    expect(dashboard).toContain("Elegí una rutina o empezá una sesión libre.");
    expect(dashboard).toContain("<StartWorkoutSheet");
    expect(dashboard).toContain("Continuar entrenamiento");
    expect(dashboard).toContain("href={`/train/session/${activeSession.id}`}");
  });

  it("loads one bounded active-session projection with real set progress", () => {
    expect(page).toContain("getHomeActiveTrainingSnapshot(auth)");
    expect(page).not.toContain("getWorkoutSessionDetail(");
    expect(training).toContain('.eq("status", "in_progress")');
    expect(training).toContain("exercises:workout_session_exercises(sets:workout_sets(is_completed))");
  });

  it("uses the approved nutrition semantics and keeps water separate from mate", () => {
    expect(dashboard).toContain("Calorías consumidas");
    expect(dashboard).toContain("<Flame className=\"size-5\"");
    expect(page).toContain("waterL: context.consumption.waterL");
    expect(page).not.toContain("mateL:");
    expect(page).toContain("energyBalanceKcal: context.metrics.energyBalanceKcal");
    expect(page).not.toContain("deltaVsNutritionTarget");
  });

  it("does not render an empty sessions block and keeps active sessions distinct", () => {
    expect(dashboard).toContain("if (!activeToday && sessions.length === 0) return null");
    expect(dashboard).toContain("En curso");
    expect(dashboard).toContain('week.sessions === 1 ? "completado" : "completados"');
    expect(dashboard).toContain("· 1 en curso");
  });

  it("links the compact shortcuts to the canonical destinations", () => {
    expect(dashboard).toContain('href="/train/routines"');
    expect(dashboard).toContain('href="/calendar"');
    expect(dashboard).toContain('href="/train/body"');
    expect(dashboard).toContain('href="/history"');
    expect(dashboard).not.toContain("Organizá y editá tus planes.");
    expect(dashboard).not.toContain("Revisá tus días y registros.");
    expect(dashboard).not.toContain("Peso y medidas.");
    expect(dashboard).not.toContain("Revisá una fecha completa.");
    expect(dashboard).toContain("grid grid-cols-2 gap-3 lg:grid-cols-4");
  });

  it("preserves the four-item bottom navigation instead of adding a Home-only tab", () => {
    expect(dashboard).not.toContain("bottomNavItems");
    expect(dashboard).not.toContain("fixed inset-x-0 bottom-0");
  });
});
