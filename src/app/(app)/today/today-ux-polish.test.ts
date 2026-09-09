import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepsFromInput } from "./steps-card-core";

const source = (path: string) => readFileSync(path, "utf8");
const todayActivity = source("src/app/(app)/today/today-activity.tsx");
const activityPanel = source("src/app/(app)/today/day-activity-panel.tsx");
const closedActivityPanel = activityPanel.slice(activityPanel.indexOf("export function DayActivityPanel"));
const activityEditor = source("src/app/(app)/today/day-context-editor.tsx");
const stepsCard = source("src/app/(app)/today/steps-card.tsx");
const todayPage = source("src/app/(app)/today/page.tsx");

describe("PR20 — Today UX polish", () => {
  it("renders a compact activity summary and moves editing into its responsive detail", () => {
    expect(todayActivity).toContain("<DayActivityPanel");
    expect(todayActivity).not.toContain("<StepsCard");
    expect(todayActivity).toContain("<ResponsiveDialog");
    expect(todayActivity).toContain("onMetricsChange={setActivity}");
    expect(todayActivity).toContain("metrics={metricSummaries}");
    expect(activityPanel).toContain('aria-label="Abrir actividad de hoy"');
    expect(activityPanel).toContain('aria-haspopup="dialog"');
    expect(activityEditor).toContain('<StepsSummary steps={values[stepsMetric.id] ?? ""} summary={stepsSummary} />');
    expect(activityPanel).not.toContain("Prom. 7 días");
    expect(activityPanel).not.toContain('href="/today/steps"');
  });

  it("keeps the closed state focused on balance and daily activity", () => {
    expect(activityPanel).not.toContain("<details");
    expect(activityPanel).toContain('"Gasto"');
    expect(activityPanel).toContain('"Balance"');
    expect(activityPanel).toContain("metrics.slice(0, 3)");
    expect(activityPanel).toContain("metric.label");
    expect(activityPanel).not.toContain("<DayContextEditor");
    expect(closedActivityPanel).not.toContain('["Trabajo"');
    expect(closedActivityPanel).not.toContain('["Entrenamiento"');
    expect(todayActivity).toContain("<ActivityContextSummary");
  });

  it("orders mobile Today as summary, add, activity and meals", () => {
    const add = todayPage.indexOf("<MealComposer");
    const activity = todayPage.indexOf("<TodayActivity");
    const meals = todayPage.indexOf("<MealList");
    expect(add).toBeGreaterThan(0);
    expect(activity).toBeGreaterThan(add);
    expect(meals).toBeGreaterThan(activity);
  });

  it("renders active metric ids with generic integer, decimal and duration controls", () => {
    expect(activityEditor).toContain("metrics.map");
    expect(activityEditor).toContain("daily-metric-${metric.id}");
    expect(activityEditor).toContain('metric.value_type === "duration"');
    expect(activityEditor).toContain("Horas");
    expect(activityEditor).toContain("Minutos");
    expect(activityEditor).toContain("min-h-4 text-xs leading-4");
    expect(activityEditor).toContain("debounceMs: 650");
    expect(activityEditor).toContain("saveDailyMetricsAction");
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
    expect(todayActivity).toContain("formatDailyMetricProgress");
    expect(todayActivity).toContain("activity[metric.id]");
    expect(activityEditor).toContain('metric.system_key === "steps"');
  });

  it("removes the legacy subtitle and work/training correction controls", () => {
    expect(todayActivity).not.toContain("Registrá pasos, agua y mate");
    expect(activityEditor).not.toContain("Usar horario habitual");
    expect(activityEditor).not.toContain("Registrar que entrené sin sesión");
    expect(activityEditor).toContain("Objetivo nutricional");
    expect(activityEditor).toContain("Gasto estimado");
    expect(activityEditor).toContain("Usar valor automático");
  });
});
