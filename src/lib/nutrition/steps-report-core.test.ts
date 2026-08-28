import { describe, expect, it } from "vitest";
import {
  aggregateStepsReport,
  buildStepsReportDays,
  lastSevenCompletedStepsRange,
} from "./steps-report-core";

const today = "2026-08-20";

describe("steps report core", () => {
  it("mantiene los huecos como null y el cero explícito como dato", () => {
    const days = buildStepsReportDays({
      range: { start: "2026-08-18", end: today },
      today,
      dayLogs: [{ log_date: "2026-08-18", steps: 0 }, { log_date: today, steps: 8_400 }],
    });
    expect(days).toEqual([
      { date: today, steps: 8_400, isToday: true, isComplete: false },
      { date: "2026-08-19", steps: null, isToday: false, isComplete: true },
      { date: "2026-08-18", steps: 0, isToday: false, isComplete: true },
    ]);
  });

  it("excluye hoy del promedio, mejor día y cobertura, pero lo permite como último registro", () => {
    const days = buildStepsReportDays({
      range: { start: "2026-08-18", end: today },
      today,
      dayLogs: [
        { log_date: "2026-08-18", steps: 0 },
        { log_date: "2026-08-19", steps: 6_000 },
        { log_date: today, steps: 20_000 },
      ],
    });
    expect(aggregateStepsReport(days)).toMatchObject({
      averageSteps: 3_000,
      bestDay: { date: "2026-08-19", steps: 6_000 },
      daysWithData: 2,
      lastRecord: { date: today, steps: 20_000 },
    });
  });

  it("no inventa datos cuando el rango no tiene registros", () => {
    const days = buildStepsReportDays({ range: { start: "2026-08-19", end: today }, today, dayLogs: [] });
    expect(aggregateStepsReport(days)).toEqual({ averageSteps: null, bestDay: null, daysWithData: 0, lastRecord: null });
  });

  it("usa exactamente los siete días calendario completos anteriores", () => {
    expect(lastSevenCompletedStepsRange(today)).toEqual({ start: "2026-08-13", end: "2026-08-19" });
  });
});
