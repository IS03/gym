import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDailyMetricValue } from "../../../lib/daily-metrics/core";

const source = (path: string) => readFileSync(path, "utf8");
const todayActivity = source("src/app/(app)/today/today-activity.tsx");
const activityPanel = source("src/app/(app)/today/day-activity-panel.tsx");
const closedActivityPanel = activityPanel.slice(activityPanel.indexOf("export function DayActivityPanel"));
const activityEditor = source("src/app/(app)/today/day-context-editor.tsx");
const todayPage = source("src/app/(app)/today/page.tsx");
const progressPage = source("src/app/(app)/progress/page.tsx");
const metricsProgressPage = source("src/app/(app)/progress/metrics/page.tsx");

describe("PR20 — Today UX polish", () => {
  it("renders a compact activity summary and moves editing into its responsive detail", () => {
    expect(todayActivity).toContain("<DayActivityPanel");
    expect(todayActivity).not.toContain("<StepsCard");
    expect(todayActivity).toContain("<ResponsiveDialog");
    expect(todayActivity).toContain("onMetricsChange={setActivity}");
    expect(todayActivity).toContain("metrics={metricSummaries}");
    expect(activityPanel).toContain('aria-label="Abrir actividad de hoy"');
    expect(activityPanel).toContain('aria-haspopup="dialog"');
    expect(activityEditor).not.toContain("StepsSummary");
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

  it("preserves null and explicit zero metric values", () => {
    expect(parseDailyMetricValue("", "integer")).toBeNull();
    expect(parseDailyMetricValue("0", "integer")).toBe(0);
    expect(parseDailyMetricValue("8421", "integer")).toBe(8421);
  });

  it("keeps Today focused on input while Progress owns metric history", () => {
    expect(activityEditor).toContain("formatDailyMetricProgress(value, metric)");
    expect(activityEditor).not.toContain('role="progressbar"');
    expect(activityEditor).not.toContain("Prom. 7 días");
    expect(activityEditor).not.toContain("Historial");
    expect(todayPage).not.toContain("getStepsOverview");
    expect(progressPage).toContain('href="/progress/metrics"');
    expect(metricsProgressPage).toContain("getDailyMetricsReport");
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
