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
      dayLogs: [{ id: "log", log_date: "2026-08-18", steps: 8_420, water_l: null, mate_l: null, weight_kg: 65 }],
      meals: [{ day_log_id: "log", entry_kind: "meal", deleted_at: null }],
      workouts: [{ day_log_id: "log", status: "completed" }],
      bodyMeasurementDates: ["2026-08-18"],
    });
    expect(day).toMatchObject({ hasNutrition: true, hasTraining: true, hasActivity: true, hasBody: true });
  });

  it("no infiere señales desde un day log vacío, comidas borradas ni sesiones no terminadas", () => {
    const days = buildGlobalCalendarDays({
      grid,
      dayLogs: [
        { id: "empty", log_date: "2026-08-18", steps: null, water_l: null, mate_l: null, weight_kg: null },
        { id: "activity", log_date: "2026-08-19", steps: null, water_l: 0, mate_l: null, weight_kg: null },
      ],
      meals: [
        { day_log_id: "empty", entry_kind: "meal", deleted_at: "2026-08-18T12:00:00Z" },
        { day_log_id: "empty", entry_kind: "other", deleted_at: null },
      ],
      workouts: [
        { day_log_id: "empty", status: "in_progress" },
        { day_log_id: "empty", status: "discarded" },
      ],
      bodyMeasurementDates: ["2026-08-20"],
    });
    expect(days[0]).toMatchObject({ hasNutrition: false, hasTraining: false, hasActivity: false, hasBody: false });
    expect(days[1]).toMatchObject({ hasActivity: true });
    expect(days[2]).toMatchObject({ hasNutrition: false, hasTraining: false, hasActivity: false, hasBody: true });
  });

  it("reconoce legacy_daily_summary activo como nutrición y peso histórico como cuerpo", () => {
    const [day] = buildGlobalCalendarDays({
      grid: [grid[0]!],
      dayLogs: [{ id: "log", log_date: "2026-08-18", steps: null, water_l: null, mate_l: null, weight_kg: 65 }],
      meals: [{ day_log_id: "log", entry_kind: "legacy_daily_summary", deleted_at: null }],
      workouts: [],
      bodyMeasurementDates: [],
    });
    expect(day).toMatchObject({ hasNutrition: true, hasBody: true });
  });
});
