import { describe, expect, it } from "vitest";
import { buildGlobalCalendarDays } from "./global-calendar-core";

const grid = [
  { date: "2026-08-18", inMonth: true },
  { date: "2026-08-19", inMonth: true },
  { date: "2026-08-20", inMonth: true },
];

describe("read model del calendario global", () => {
  it("combina las cuatro señales canónicas en una misma fecha", () => {
    const [day] = buildGlobalCalendarDays({
      grid: [grid[0]!],
      dayLogs: [{ id: "log", log_date: "2026-08-18", weight_kg: 65 }],
      meals: [{ day_log_id: "log", entry_kind: "meal", deleted_at: null }],
      workouts: [{ day_log_id: "log", status: "completed" }],
      metrics: [{ metric_date: "2026-08-18", value: 0 }],
      bodyMeasurementDates: ["2026-08-18"],
    });
    expect(day).toMatchObject({ hasNutrition: true, hasTraining: true, hasMetrics: true, hasBody: true });
  });

  it("no infiere señales desde un day log vacío, comidas borradas ni sesiones no terminadas", () => {
    const days = buildGlobalCalendarDays({
      grid,
      dayLogs: [
        { id: "empty", log_date: "2026-08-18", weight_kg: null },
      ],
      meals: [
        { day_log_id: "empty", entry_kind: "meal", deleted_at: "2026-08-18T12:00:00Z" },
        { day_log_id: "empty", entry_kind: "other", deleted_at: null },
      ],
      workouts: [
        { day_log_id: "empty", status: "in_progress" },
        { day_log_id: "empty", status: "discarded" },
      ],
      metrics: [{ metric_date: "2026-08-19", value: 0 }],
      bodyMeasurementDates: ["2026-08-20"],
    });
    expect(days[0]).toMatchObject({ hasNutrition: false, hasTraining: false, hasMetrics: false, hasBody: false });
    expect(days[1]).toMatchObject({ hasMetrics: true });
    expect(days[2]).toMatchObject({ hasNutrition: false, hasTraining: false, hasMetrics: false, hasBody: true });
  });

  it("reconoce legacy_daily_summary activo como nutrición y peso histórico como cuerpo", () => {
    const [day] = buildGlobalCalendarDays({
      grid: [grid[0]!],
      dayLogs: [{ id: "log", log_date: "2026-08-18", weight_kg: 65 }],
      meals: [{ day_log_id: "log", entry_kind: "legacy_daily_summary", deleted_at: null }],
      workouts: [],
      metrics: [],
      bodyMeasurementDates: [],
    });
    expect(day).toMatchObject({ hasNutrition: true, hasBody: true });
  });
});
