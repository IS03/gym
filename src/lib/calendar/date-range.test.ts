import { describe, expect, it } from "vitest";

import { NUTRITION_REPORT_MAX_DAYS } from "../nutrition/reports-core";
import { isDateInRange, isDateSelectable, selectDateRange } from "./date-range";

describe("selección de rango de fechas", () => {
  it("fija sólo el inicio con el primer toque", () => {
    expect(selectDateRange({ start: null, end: null }, "2026-08-17", NUTRITION_REPORT_MAX_DAYS)).toEqual({
      value: { start: "2026-08-17", end: null },
      error: null,
    });
  });

  it("completa, ordena y permite un rango de un solo día", () => {
    expect(selectDateRange({ start: "2026-08-17", end: null }, "2026-08-23", NUTRITION_REPORT_MAX_DAYS).value)
      .toEqual({ start: "2026-08-17", end: "2026-08-23" });
    expect(selectDateRange({ start: "2026-08-17", end: null }, "2026-08-12", NUTRITION_REPORT_MAX_DAYS).value)
      .toEqual({ start: "2026-08-12", end: "2026-08-17" });
    expect(selectDateRange({ start: "2026-08-17", end: null }, "2026-08-17", NUTRITION_REPORT_MAX_DAYS).value)
      .toEqual({ start: "2026-08-17", end: "2026-08-17" });
  });

  it("inicia un rango nuevo después de completar el actual", () => {
    expect(selectDateRange({ start: "2026-08-17", end: "2026-08-23" }, "2026-08-25", NUTRITION_REPORT_MAX_DAYS))
      .toEqual({ value: { start: "2026-08-25", end: null }, error: null });
  });

  it("soporta cruces de mes y año", () => {
    const monthCrossing = selectDateRange({ start: "2026-08-30", end: null }, "2026-09-02", NUTRITION_REPORT_MAX_DAYS).value;
    const yearCrossing = selectDateRange({ start: "2026-12-31", end: null }, "2027-01-02", NUTRITION_REPORT_MAX_DAYS).value;

    expect(monthCrossing).toEqual({ start: "2026-08-30", end: "2026-09-02" });
    expect(yearCrossing).toEqual({ start: "2026-12-31", end: "2027-01-02" });
    expect(isDateInRange("2026-09-01", monthCrossing)).toBe(true);
  });

  it("acepta 366 días inclusivos y rechaza 367 conservando la selección", () => {
    const accepted = selectDateRange(
      { start: "2025-08-21", end: null },
      "2026-08-21",
      NUTRITION_REPORT_MAX_DAYS,
    );
    const rejected = selectDateRange(
      { start: "2025-08-20", end: null },
      "2026-08-21",
      NUTRITION_REPORT_MAX_DAYS,
    );

    expect(accepted).toEqual({ value: { start: "2025-08-21", end: "2026-08-21" }, error: null });
    expect(rejected.value).toEqual({ start: "2025-08-20", end: null });
    expect(rejected.error).toContain("366");
  });

  it("no permite seleccionar fechas futuras", () => {
    expect(isDateSelectable("2026-08-21", "2026-08-21")).toBe(true);
    expect(isDateSelectable("2026-08-22", "2026-08-21")).toBe(false);
  });
});
