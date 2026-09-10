import { describe, expect, it } from "vitest";
import { formatTrainingDayHeading } from "./session-history";
import {
  formatTrainingDayVolume,
  orderTrainingDaySessions,
  summarizeTrainingDay,
  summarizeTrainingSessionVolume,
} from "./training-day-summary";
import type { CompletedSessionSummary } from "./types";

function session(
  overrides: Partial<CompletedSessionSummary>,
): CompletedSessionSummary {
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
    volumeKg: 1_200,
    muscleGroups: ["Pecho"],
    ...overrides,
  };
}

describe("resumen histórico de un día de entrenamiento", () => {
  it("suma las duraciones reales de varias sesiones, no el intervalo entre ellas", () => {
    const summary = summarizeTrainingDay([
      session({
        durationMilliseconds: 30 * 60_000,
        exercisesCompleted: 4,
        completedSets: 12,
      }),
      session({
        id: "session-2",
        durationMilliseconds: 45 * 60_000,
        exercisesCompleted: 5,
        completedSets: 15,
      }),
    ]);

    expect(summary).toEqual({
      sessionCount: 2,
      exercisesCompleted: 9,
      completedSets: 27,
      durationMilliseconds: 75 * 60_000,
      volumeKg: 2_400,
    });
  });

  it("no presenta una duración total como conocida si falta la duración de una sesión", () => {
    const summary = summarizeTrainingDay([
      session({ durationMilliseconds: 30 * 60_000 }),
      session({ id: "session-2", durationMilliseconds: null }),
    ]);

    expect(summary.durationMilliseconds).toBeNull();
  });

  it("suma el volumen histórico por sesión y conserva desconocido si falta una fuente fiable", () => {
    expect(
      summarizeTrainingSessionVolume([
        { actual_reps: 10, actual_weight_kg: 100 },
        { actual_reps: 8, actual_weight_kg: 90 },
      ]),
    ).toBe(1_720);
    expect(summarizeTrainingSessionVolume([])).toBe(0);
    expect(
      summarizeTrainingSessionVolume([
        { actual_reps: null, actual_weight_kg: null },
      ]),
    ).toBeNull();

    const summary = summarizeTrainingDay([
      session({ volumeKg: 1_720 }),
      session({ id: "session-2", volumeKg: null }),
    ]);
    expect(summary.volumeKg).toBeNull();
  });

  it("formatea volumen sin decimales absurdos y distingue cero de ausencia", () => {
    expect(formatTrainingDayVolume(12_090.4)).toBe("12.090 kg");
    expect(formatTrainingDayVolume(0)).toBe("0 kg");
    expect(formatTrainingDayVolume(null)).toBeNull();
  });

  it("ordena las sesiones por inicio y conserva la fecha lógica y capitalización natural de Córdoba", () => {
    const ordered = orderTrainingDaySessions([
      session({ id: "later", startedAt: "2026-08-27T19:00:00.000Z" }),
      session({ id: "earlier", startedAt: "2026-08-27T17:00:00.000Z" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["earlier", "later"]);
    expect(formatTrainingDayHeading("2026-08-27")).toBe("Jueves, 27 de agosto");
    expect(formatTrainingDayHeading("2026-08-28")).toBe(
      "Viernes, 28 de agosto",
    );
    expect(formatTrainingDayHeading("2026-08-31")).toBe("Lunes, 31 de agosto");
  });
});
