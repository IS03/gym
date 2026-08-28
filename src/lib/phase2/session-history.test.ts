import { describe, expect, it } from "vitest";
import { daysBetweenIsoDates, formatRelativeTrainingDays, leastRecentRoutine } from "./session-history";

describe("historial de sesiones", () => {
  it("calcula días de continuidad sin recomendar una rutina", () => {
    expect(daysBetweenIsoDates("2026-08-01", "2026-08-09")).toBe(8);
    expect(formatRelativeTrainingDays(3)).toBe("hace 3 días");
    expect(formatRelativeTrainingDays(null)).toBe("Sin registros");
  });

  it("encuentra la rutina activa menos reciente", () => {
    expect(leastRecentRoutine([
      { routineId: "push", routineName: "PUSH", lastLogDate: "2026-08-05", daysSince: 5 },
      { routineId: "pull", routineName: "PULL", lastLogDate: "2026-08-08", daysSince: 2 },
      { routineId: "legs", routineName: "LEGS", lastLogDate: "2026-08-01", daysSince: 9 },
    ])).toMatchObject({ routineId: "legs", daysSince: 9 });
  });
});
