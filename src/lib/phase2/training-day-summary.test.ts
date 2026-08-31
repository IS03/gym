import { describe, expect, it } from "vitest";
import { formatTrainingDayHeading } from "./session-history";
import {
  orderTrainingDaySessions,
  summarizeTrainingDay,
} from "./training-day-summary";
import type { CompletedSessionSummary } from "./types";

function session(overrides: Partial<CompletedSessionSummary>): CompletedSessionSummary {
  return {
    id: "session-1",
    routineId: "routine-1",
    routineName: "PUSH",
    logDate: "2026-08-27",
    startedAt: "2026-08-27T17:00:00.000Z",
    endedAt: "2026-08-27T17:30:00.000Z",
    durationMilliseconds: 30 * 60_000,
    exercisesCompleted: 4,
    completedSets: 12,
    muscleGroups: ["Pecho"],
    ...overrides,
  };
}

describe("resumen histórico de un día de entrenamiento", () => {
  it("suma las duraciones reales de varias sesiones, no el intervalo entre ellas", () => {
    const summary = summarizeTrainingDay([
      session({ durationMilliseconds: 30 * 60_000, exercisesCompleted: 4, completedSets: 12 }),
      session({ id: "session-2", durationMilliseconds: 45 * 60_000, exercisesCompleted: 5, completedSets: 15 }),
    ]);

    expect(summary).toEqual({
      sessionCount: 2,
      exercisesCompleted: 9,
      completedSets: 27,
      durationMilliseconds: 75 * 60_000,
    });
  });

  it("no presenta una duración total como conocida si falta la duración de una sesión", () => {
    const summary = summarizeTrainingDay([
      session({ durationMilliseconds: 30 * 60_000 }),
      session({ id: "session-2", durationMilliseconds: null }),
    ]);

    expect(summary.durationMilliseconds).toBeNull();
  });

  it("ordena las sesiones por inicio y conserva la fecha lógica de Córdoba", () => {
    const ordered = orderTrainingDaySessions([
      session({ id: "later", startedAt: "2026-08-27T19:00:00.000Z" }),
      session({ id: "earlier", startedAt: "2026-08-27T17:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["earlier", "later"]);
    expect(formatTrainingDayHeading("2026-08-27")).toBe("jueves, 27 de agosto");
  });
});
