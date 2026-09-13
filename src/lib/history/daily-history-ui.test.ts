import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/history/page.tsx");
const picker = source("src/components/history/daily-history-date-navigator.tsx");
const metricsAction = source("src/app/(app)/history/historical-metrics-actions.ts");
const trainingCalendar = source("src/app/(app)/train/calendar/page.tsx");

describe("Historial diario V2", () => {
  it("mantiene una fecha canónica deep-linkable y un día vacío válido", () => {
    expect(page).toContain("isHistoryDate(requestedDate)");
    expect(page).toContain("getDailyHistoryDetail(requestedDate, auth)");
    expect(page).toContain("No hay registros para este día.");
    expect(page).not.toContain("redirect(requestedDate");
  });

  it("integra navegación anterior/siguiente y selección rápida de una fecha", () => {
    expect(page).toContain("<DailyHistoryDateNavigator");
    expect(picker).toContain('aria-label="Día anterior"');
    expect(picker).toContain('aria-label="Día siguiente"');
    expect(picker).toContain('aria-label="Cambiar año"');
    expect(picker).toContain('aria-label="Cambiar mes"');
    expect(picker).toContain("buildMonthGrid(visibleMonth, { full: true })");
    expect(picker).not.toContain('type="date"');
  });

  it("conserva el origen en cada cambio y mantiene un Back explícito", () => {
    expect(page).toContain("parseDailyHistoryOrigin(sp)");
    expect(page).toContain("dailyHistoryReturnTarget(origin)");
    expect(page).toContain("dailyHistoryDetailHref(adjacentHistoryDate(requestedDate, -1), origin)");
    expect(picker).toContain("dailyHistoryDetailHref(date, origin)");
  });

  it("respeta la jerarquía factual aprobada sin comparaciones ni insights", () => {
    const summary = page.indexOf('data-history-section="summary"');
    const metrics = page.indexOf('data-history-section="metrics"');
    const training = page.indexOf('data-history-section="training"');
    const nutrition = page.indexOf('data-history-section="nutrition"');
    const meals = page.indexOf('data-history-section="meals"');
    const navigation = page.indexOf('data-history-section="navigation"');
    expect([summary, metrics, training, nutrition, meals, navigation].every((index) => index >= 0)).toBe(true);
    expect(summary).toBeLessThan(metrics);
    expect(metrics).toBeLessThan(training);
    expect(training).toBeLessThan(nutrition);
    expect(nutrition).toBeLessThan(meals);
    expect(meals).toBeLessThan(navigation);
    expect(page).not.toContain("ComparisonWorkspace");
    expect(page).not.toContain("Qué cambió");
  });

  it("marca hoy en curso, bloquea futuro y conserva la navegación inferior", () => {
    expect(page).toContain("Hoy · en curso");
    expect(page).toContain("requestedDate > today");
    expect(page).toContain("requestedDate < today");
    expect(page).toContain("Navegación por fecha al final del día");
    expect(metricsAction).toContain("input.date > todayInCordoba()");
  });

  it("no reemplaza ni reinterpreta el calendario específico de Training", () => {
    expect(trainingCalendar).toContain("trainingCalendarHref(addMonths(month, -1), routineId)");
    expect(trainingCalendar).toContain("trainingCalendarHref(addMonths(month, 1), routineId)");
    expect(trainingCalendar).toContain("listTrainingDaysInMonth");
    expect(trainingCalendar).not.toContain("DailyHistoryDateNavigator");
  });
});
