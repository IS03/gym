import { describe, expect, it } from "vitest";
import type { ExerciseReportSession, ExerciseReportSet } from "./exercise-insights";
import {
  quickHistoryCompletedSets,
  quickHistoryLatestSummary,
  quickHistorySetLabel,
  recentExerciseHistorySessions,
} from "./quick-exercise-history";

const set = (overrides: Partial<ExerciseReportSet> = {}): ExerciseReportSet => ({
  id: "set-1",
  set_number: 1,
  target_reps: 10,
  target_weight_kg: 80,
  target_rir: 2,
  actual_reps: 10,
  actual_weight_kg: 80,
  is_completed: true,
  ...overrides,
});

const session = (overrides: Partial<ExerciseReportSession> = {}): ExerciseReportSession => ({
  sessionId: "session-1",
  logDate: "2026-09-01",
  completedAt: "2026-09-01T18:00:00.000Z",
  routineId: "push",
  routineName: "PUSH histórico",
  decision: "maintain",
  sets: [set()],
  ...overrides,
});

describe("historial rápido de ejercicio", () => {
  it("ordena las sesiones finalizadas de más reciente a más antigua y limita la consulta rápida", () => {
    const sessions = Array.from({ length: 6 }, (_, index) =>
      session({
        sessionId: `session-${index + 1}`,
        logDate: `2026-09-0${index + 1}`,
        completedAt: `2026-09-0${index + 1}T18:00:00.000Z`,
      }),
    );

    expect(recentExerciseHistorySessions(sessions).map((item) => item.sessionId)).toEqual([
      "session-6",
      "session-5",
      "session-4",
      "session-3",
      "session-2",
    ]);
  });

  it("muestra solamente series realizadas y conserva los valores históricos", () => {
    const item = session({
      sets: [
        set({ id: "done", actual_reps: 9, actual_weight_kg: 90, target_rir: 1 }),
        set({ id: "pending", actual_reps: 10, actual_weight_kg: 90, is_completed: false }),
      ],
    });

    expect(quickHistoryCompletedSets(item)).toEqual([item.sets[0]]);
    expect(quickHistorySetLabel(item.sets[0]!)).toBe("9 × 90 kg");
  });

  it("no inventa carga cero para ejercicios sin peso ni convierte null en cero", () => {
    expect(quickHistorySetLabel(set({ actual_reps: 42, actual_weight_kg: null }))).toBe("42 reps");
    expect(quickHistorySetLabel(set({ actual_reps: null, actual_weight_kg: null }))).toBe(
      "Sin carga ni reps registradas",
    );
  });

  it("mantiene el orden de las series de la última sesión y no oculta valores históricos reales", () => {
    const item = session({
      sets: [
        set({ id: "one", set_number: 1, actual_reps: 10, actual_weight_kg: 90 }),
        set({ id: "two", set_number: 2, actual_reps: 9, actual_weight_kg: 90, target_rir: null }),
      ],
    });

    expect(quickHistoryLatestSummary(item)).toBe("10 × 90 kg · 9 × 90 kg");
    expect(quickHistoryCompletedSets(item).map((entry) => entry.set_number)).toEqual([1, 2]);
  });
});
