import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepsFromInput } from "./steps-card-core";

const source = (path: string) => readFileSync(path, "utf8");
const todayActivity = source("src/app/(app)/today/today-activity.tsx");
const activityPanel = source("src/app/(app)/today/day-activity-panel.tsx");
const activityEditor = source("src/app/(app)/today/day-context-editor.tsx");
const stepsCard = source("src/app/(app)/today/steps-card.tsx");

describe("PR20 — Today UX polish", () => {
  it("renders a compact activity summary and moves editing into its responsive detail", () => {
    expect(todayActivity).toContain("<DayActivityPanel");
    expect(todayActivity).not.toContain("<StepsCard");
    expect(todayActivity).toContain("<ResponsiveDialog");
    expect(todayActivity).toContain("onActivityChange={setActivity}");
    expect(todayActivity).toContain("activityValuesLabel={activityValuesLabel}");
    expect(activityPanel).toContain('aria-label="Abrir actividad de hoy"');
    expect(activityPanel).toContain('aria-haspopup="dialog"');
    expect(activityEditor).toContain("<StepsSummary steps={steps} summary={stepsSummary} />");
    expect(activityPanel).not.toContain("Prom. 7 días");
    expect(activityPanel).not.toContain('href="/today/steps"');
  });

  it("keeps one closed-state representation for context, steps, water and mate", () => {
    expect(activityPanel).not.toContain("<details");
    for (const label of ["Trabajo", "Entrenamiento", "Gasto", "Balance"]) {
      expect(activityPanel).toContain(`\"${label}\"`);
    }
    for (const label of ["Pasos", "Agua", "Mate"]) expect(activityPanel).toContain(`>${label}<`);
    expect(activityPanel).not.toContain("<DayContextEditor");
  });

  it("keeps the three daily inputs, the water target and a stable autosave slot in detail", () => {
    for (const field of ["daily-steps", "daily-water", "daily-mate"]) {
      expect(activityEditor).toContain(`htmlFor="${field}"`);
    }
    expect(activityEditor).toContain("grid grid-cols-3");
    expect(activityEditor).toContain("· meta {waterTargetLabel}");
    expect(activityEditor).toContain("truncate font-normal text-muted-foreground");
    expect(activityEditor).toContain("min-h-4 text-xs leading-4");
    expect(activityEditor).toContain("debounceMs: 650");
    expect(activityEditor.match(/queueRef\.current\?\.flush\(\)/g)).toHaveLength(3);
  });

  it("keeps only Correcciones del día collapsible with an accessible rotating chevron", () => {
    expect(activityEditor.match(/<details/g)).toHaveLength(1);
    expect(activityEditor).toContain("Correcciones del día");
    expect(activityEditor).toContain("group-open/corrections:rotate-90");
    expect(activityEditor).toContain("focus-visible:ring-2");
    expect(activityEditor).toContain("motion-reduce:transition-none");
  });

  it("preserves null, invalid and explicit zero step values", () => {
    expect(stepsFromInput("")).toBeNull();
    expect(stepsFromInput("invalid")).toBeNull();
    expect(stepsFromInput("0")).toBe(0);
    expect(stepsFromInput("8421")).toBe(8421);
  });

  it("uses the compact integrated steps summary without a second card", () => {
    expect(stepsCard).toContain("export function StepsSummary");
    expect(stepsCard).not.toContain("<Card");
    expect(stepsCard).toContain('href="/today/steps"');
    expect(stepsCard).toContain("Historial");
    expect(stepsCard).toContain("text-lg");
    expect(stepsCard).toContain("Prom. 7 días");
    expect(stepsCard).toContain("{summary.daysWithData}/7 días");
    expect(stepsCard).toContain("Sin datos en los últimos 7 días");
    expect(todayActivity).toContain("formatSteps(activity.steps)");
    expect(todayActivity).toContain("formatLiters(activity.waterL)");
    expect(todayActivity).toContain("formatLiters(activity.mateL)");
  });
});
