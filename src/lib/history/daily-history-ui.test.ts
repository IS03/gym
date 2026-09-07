import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/history/page.tsx");
const picker = source("src/components/history/daily-history-date-navigator.tsx");
const trainingCalendar = source("src/app/(app)/train/calendar/page.tsx");

describe("Historial diario V2", () => {
  it("mantiene una fecha canónica deep-linkable y un día vacío válido", () => {
    expect(page).toContain("isHistoryDate(requestedDate)");
    expect(page).toContain("getDailyHistoryDetail(requestedDate, auth)");
    expect(page).toContain("No hay registros para esta fecha.");
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

  it("no reemplaza ni reinterpreta el calendario específico de Training", () => {
    expect(trainingCalendar).toContain("trainingCalendarHref(addMonths(month, -1), routineId)");
    expect(trainingCalendar).toContain("trainingCalendarHref(addMonths(month, 1), routineId)");
    expect(trainingCalendar).toContain("listTrainingDaysInMonth");
    expect(trainingCalendar).not.toContain("DailyHistoryDateNavigator");
  });
});
