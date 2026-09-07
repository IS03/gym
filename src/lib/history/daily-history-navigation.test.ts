import { describe, expect, it } from "vitest";

import { todayInCordoba } from "../phase2/cordoba-date";
import {
  adjacentHistoryDate,
  dailyHistoryDetailHref,
  dailyHistoryReturnTarget,
  isHistoryDate,
  parseDailyHistoryOrigin,
} from "./daily-history-navigation";

describe("navegación del historial diario", () => {
  it("valida fechas lógicas reales y conserva el día de Córdoba", () => {
    expect(isHistoryDate("2026-09-07")).toBe(true);
    expect(isHistoryDate("2026-02-29")).toBe(false);
    expect(isHistoryDate("2028-02-29")).toBe(true);
    expect(isHistoryDate("2026-13-01")).toBe(false);
    expect(isHistoryDate("otra-cosa")).toBe(false);
    expect(todayInCordoba(new Date("2026-09-07T02:30:00Z"))).toBe("2026-09-06");
  });

  it("navega entre días, meses, años y el día bisiesto", () => {
    expect(adjacentHistoryDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(adjacentHistoryDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(adjacentHistoryDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(adjacentHistoryDate("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("preserva Historial como origen durante la navegación", () => {
    const origin = parseDailyHistoryOrigin({ from: "history" });
    expect(origin).toEqual({ source: "history" });
    expect(dailyHistoryDetailHref("2026-08-24", origin)).toBe("/history?date=2026-08-24&from=history");
    expect(dailyHistoryReturnTarget(origin)).toEqual({ href: "/history", label: "Historial" });
  });

  it("preserva el mes de Calendario al recorrer varios días", () => {
    const origin = parseDailyHistoryOrigin({ from: "calendar", month: "2026-08" });
    expect(origin).toEqual({ source: "calendar", month: "2026-08" });
    const nextDate = adjacentHistoryDate("2026-08-31", 1);
    expect(dailyHistoryDetailHref(nextDate, origin)).toBe("/history?date=2026-09-01&from=calendar&month=2026-08");
    expect(dailyHistoryReturnTarget(origin)).toEqual({ href: "/calendar?month=2026-08", label: "Calendario" });
  });

  it("usa un fallback explícito y nunca acepta un return URL arbitrario", () => {
    expect(parseDailyHistoryOrigin({ from: "https://evil.example" })).toBeNull();
    expect(parseDailyHistoryOrigin({ from: "calendar", month: "javascript:alert(1)" })).toBeNull();
    expect(parseDailyHistoryOrigin({ from: "calendar", month: "2026-99" })).toBeNull();
    expect(dailyHistoryReturnTarget(null)).toEqual({ href: "/history", label: "Historial" });
  });
});
