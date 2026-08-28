import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepsFromInput } from "./steps-card-core";

const source = (path: string) => readFileSync(path, "utf8");
const todayActivity = source("src/app/(app)/today/today-activity.tsx");
const activityPanel = source("src/app/(app)/today/day-activity-panel.tsx");
const activityEditor = source("src/app/(app)/today/day-context-editor.tsx");
const stepsCard = source("src/app/(app)/today/steps-card.tsx");

describe("PR20 — Today UX polish", () => {
  it("renders daily activity before the compact steps card", () => {
    expect(todayActivity.indexOf("<DayActivityPanel")).toBeLessThan(todayActivity.indexOf("<StepsCard"));
    expect(todayActivity).toContain("steps={activity.steps}");
    expect(todayActivity).toContain("onActivityChange={setActivity}");
  });

  it("keeps the operational activity card visible and removes duplicate summaries", () => {
    expect(activityPanel).not.toContain("<details");
    expect(activityPanel.match(/>Trabajo</g)).toHaveLength(1);
    expect(activityPanel.match(/>Entrenamiento</g)).toHaveLength(1);
    expect(activityPanel.match(/>Gasto</g)).toHaveLength(1);
    expect(activityPanel.match(/>Balance</g)).toHaveLength(1);
    expect(activityPanel).toContain("<DayContextEditor");
  });

  it("shows the three daily inputs with the water target and a stable autosave slot", () => {
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

  it("uses the compact StepsCard composition without the previous tall rows", () => {
    expect(stepsCard).toContain('<Card size="sm"');
    expect(stepsCard).toContain('href="/today/steps"');
    expect(stepsCard).toContain("Historial →");
    expect(stepsCard).toContain("text-2xl");
    expect(stepsCard).not.toContain("text-3xl");
    expect(stepsCard).not.toContain("border-t");
    expect(stepsCard).toContain("Prom. 7 días");
    expect(stepsCard).toContain("{summary.daysWithData}/7 días");
    expect(stepsCard).toContain("Sin datos en los últimos 7 días");
  });
});
