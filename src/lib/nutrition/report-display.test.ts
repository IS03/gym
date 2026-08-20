import { describe, expect, it } from "vitest";
import {
  formatNutritionReportRange,
  getVisibleNutritionReportDays,
} from "./report-display";

describe("formatNutritionReportRange", () => {
  it("formats a range in the same month without technical ISO dates", () => {
    const result = formatNutritionReportRange("2026-08-14", "2026-08-20");
    expect(result).toContain("14");
    expect(result).toContain("20");
    expect(result).toMatch(/ago/i);
    expect(result).not.toContain("2026");
  });

  it("keeps both months when a range crosses a month", () => {
    const result = formatNutritionReportRange("2026-08-28", "2026-09-03");
    expect(result).toContain("28");
    expect(result).toContain("3");
    expect(result).toMatch(/ago/i);
    expect(result).toMatch(/sept/i);
  });

  it("includes years when a range crosses a year", () => {
    const result = formatNutritionReportRange("2025-12-28", "2026-01-03");
    expect(result).toContain("2025");
    expect(result).toContain("2026");
  });

  it("formats a single day without a separator", () => {
    const result = formatNutritionReportRange("2026-08-14", "2026-08-14");
    expect(result).toContain("14");
    expect(result).not.toContain("—");
  });
});

describe("getVisibleNutritionReportDays", () => {
  const days = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  }));

  it("keeps all ranges up to seven days visible", () => {
    expect(getVisibleNutritionReportDays(days.slice(0, 1), false).days).toHaveLength(1);
    expect(getVisibleNutritionReportDays(days.slice(0, 7), false).days).toHaveLength(7);
  });

  it("shows the seven most recent days first without mutating chart data", () => {
    const original = [...days];
    const visible = getVisibleNutritionReportDays(days, false);
    expect(visible.days).toHaveLength(7);
    expect(visible.days[0]?.date).toBe("2026-08-30");
    expect(visible.days.at(-1)?.date).toBe("2026-08-24");
    expect(visible.hasMore).toBe(true);
    expect(days).toEqual(original);
  });

  it("expands and collapses locally", () => {
    expect(getVisibleNutritionReportDays(days, true).days).toHaveLength(30);
    expect(getVisibleNutritionReportDays(days, false).days).toHaveLength(7);
  });
});
