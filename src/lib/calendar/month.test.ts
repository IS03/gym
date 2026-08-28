import { describe, expect, it } from "vitest";
import { addMonths, buildMonthGrid, isCalendarMonth, resolveCalendarMonth } from "./month";

describe("helpers del calendario mensual", () => {
  it("construye una grilla completa de 42 días empezando lunes", () => {
    const grid = buildMonthGrid("2026-08", { full: true });
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ date: "2026-07-27", inMonth: false });
    expect(grid.at(-1)).toEqual({ date: "2026-09-06", inMonth: false });
  });

  it("valida el mes y normaliza ausentes, inválidos y futuros", () => {
    expect(isCalendarMonth("2026-08")).toBe(true);
    expect(isCalendarMonth("2026-00")).toBe(false);
    expect(isCalendarMonth("2026-13")).toBe(false);
    expect(isCalendarMonth("basura")).toBe(false);
    expect(resolveCalendarMonth(undefined, "2026-08")).toBe("2026-08");
    expect(resolveCalendarMonth("2026-00", "2026-08")).toBe("2026-08");
    expect(resolveCalendarMonth("2026-09", "2026-08")).toBe("2026-08");
    expect(resolveCalendarMonth("2026-07", "2026-08")).toBe("2026-07");
  });

  it("navega correctamente diciembre y enero", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
