import { describe, expect, it } from "vitest";
import {
  completedExerciseSummary,
  completionStats,
  initialExpandedExerciseId,
  nextSessionReminder,
  formatWorkoutClockTime,
  formatWorkoutDuration,
  formatWorkoutTimeRange,
  getWorkoutElapsedMilliseconds,
  renumberWorkoutPayload,
  sessionHasCardioExercise,
  sessionMetadataFromSession,
  toggleTrainingDecision,
} from "./session-editor-helpers";
import type { WorkoutExercisePayload, WorkoutSessionClient } from "@/lib/phase2/types";

function payload(): WorkoutExercisePayload {
  return {
    is_completed: true,
    decision: "increase_weight",
    decision_note: "",
    apply_to_routine: false,
    notes: "",
    sets: [
      {
        set_number: 1,
        target_reps: 10,
        target_weight_kg: 20,
        target_rir: 1,
        actual_reps: 10,
        actual_weight_kg: 20,
        is_completed: true,
        notes: null,
      },
      {
        set_number: 2,
        target_reps: 10,
        target_weight_kg: 20,
        target_rir: 0,
        actual_reps: 8,
        actual_weight_kg: 20,
        is_completed: false,
        notes: null,
      },
    ],
  };
}

describe("borrador de sesión", () => {
  it.each([
    ["maintain", "increase_weight", "increase_weight"],
    ["increase_weight", "increase_weight", "maintain"],
    ["maintain", "increase_reps", "increase_reps"],
    ["increase_reps", "increase_reps", "maintain"],
    ["increase_weight", "increase_reps", "increase_reps"],
    ["increase_reps", "increase_weight", "increase_weight"],
    ["custom", "increase_weight", "increase_weight"],
    ["custom", "increase_reps", "increase_reps"],
    ["custom", "maintain", "maintain"],
  ] as const)("cambia %s con %s a %s", (current, clicked, expected) => {
    expect(toggleTrainingDecision(current, clicked)).toBe(expected);
  });

  it("muestra sólo el recordatorio heredado y no reutiliza la decisión nueva", () => {
    expect(nextSessionReminder("increase_weight", null)).toBe("Subir peso");
    expect(nextSessionReminder("increase_reps", null)).toBe("Subir repeticiones");
    expect(nextSessionReminder("custom", " Probar 30 kg en la primera serie ")).toBe(
      "Probar 30 kg en la primera serie",
    );
    expect(nextSessionReminder("maintain", null)).toBeNull();
    expect(nextSessionReminder("custom", "   ")).toBeNull();
  });

  it("renumera al quitar una serie y conserva el estado global", () => {
    const value = payload();
    value.sets = [value.sets[1]];
    const result = renumberWorkoutPayload(value);
    expect(result.sets[0].set_number).toBe(1);
    expect(result.is_completed).toBe(false);
  });

  it("cuenta como terminado solo el ejercicio con todas sus series hechas", () => {
    expect(completionStats([payload()])).toEqual({
      completedSets: 1,
      totalSets: 2,
      completedExercises: 0,
    });
  });

  it("abre primero el ejercicio parcialmente realizado", () => {
    const pending = payload();
    pending.sets = pending.sets.map((set) => ({ ...set, is_completed: false }));
    pending.is_completed = false;
    const partial = payload();

    expect(
      initialExpandedExerciseId([
        { id: "pending", payload: pending },
        { id: "partial", payload: partial },
      ]),
    ).toBe("partial");
  });

  it("abre el primer pendiente y deja todo cerrado si la sesión terminó", () => {
    const pending = payload();
    pending.sets = pending.sets.map((set) => ({ ...set, is_completed: false }));
    pending.is_completed = false;
    expect(initialExpandedExerciseId([{ id: "pending", payload: pending }])).toBe(
      "pending",
    );

    const complete = payload();
    complete.sets = complete.sets.map((set) => ({ ...set, is_completed: true }));
    complete.is_completed = true;
    expect(initialExpandedExerciseId([{ id: "complete", payload: complete }])).toBeNull();
  });

  it("resume pesos variables y repeticiones realizadas", () => {
    const value = payload();
    value.sets[1] = {
      ...value.sets[1],
      actual_weight_kg: 22.5,
      is_completed: true,
    };
    expect(completedExerciseSummary(value)).toBe("20–22,5 kg · 10 / 8 reps");
  });
});

describe("tiempo de sesión", () => {
  it("formatea duraciones en minutos y horas", () => {
    expect(formatWorkoutDuration(0)).toBe("<1 min");
    expect(formatWorkoutDuration(7 * 60_000)).toBe("7 min");
    expect(formatWorkoutDuration(64 * 60_000)).toBe("1 h 04 min");
    expect(formatWorkoutDuration(123 * 60_000)).toBe("2 h 03 min");
  });

  it("calcula la duración con timestamps completos, incluso al cambiar de día", () => {
    expect(
      getWorkoutElapsedMilliseconds("2026-08-10T23:50:00.000Z", "2026-08-11T00:25:00.000Z"),
    ).toBe(35 * 60_000);
  });

  it("muestra el rango horario local de Córdoba", () => {
    expect(formatWorkoutClockTime("2026-08-10T19:08:00.000Z")).toBe("16:08");
    expect(
      formatWorkoutTimeRange("2026-08-10T19:08:00.000Z", "2026-08-10T20:24:00.000Z"),
    ).toBe("16:08–17:24");
  });

  it("degrada de forma segura ante timestamps inválidos o duración negativa", () => {
    expect(getWorkoutElapsedMilliseconds(null, "2026-08-10T19:08:00.000Z")).toBeNull();
    expect(getWorkoutElapsedMilliseconds("2026-08-10T19:08:00.000Z", "inválido")).toBeNull();
    expect(
      getWorkoutElapsedMilliseconds("2026-08-10T20:00:00.000Z", "2026-08-10T19:00:00.000Z"),
    ).toBeNull();
    expect(formatWorkoutTimeRange(null, "2026-08-10T20:24:00.000Z")).toBeNull();
  });
});

describe("metadata de sesión", () => {
  it("no lleva abs_completed al payload nuevo aunque un registro legado lo tenga", () => {
    const legacySession = {
      id: "session-1",
      routine_name_snapshot: "PUSH",
      session_name: null,
      status: "completed",
      started_at: "2026-08-10T19:00:00.000Z",
      ended_at: "2026-08-10T20:00:00.000Z",
      energy_level: 4,
      performance_level: 5,
      pain_level: 0,
      pain_note: null,
      abs_completed: true,
      treadmill_minutes: null,
      treadmill_distance_km: null,
      treadmill_speed_kmh: null,
      treadmill_incline_percent: null,
      notes: null,
    } as unknown as WorkoutSessionClient;

    expect(sessionMetadataFromSession(legacySession)).toEqual({
      session_name: "PUSH",
      energy_level: 4,
      performance_level: 5,
      pain_level: 0,
      pain_note: "",
      treadmill_minutes: null,
      treadmill_distance_km: null,
      treadmill_speed_kmh: null,
      treadmill_incline_percent: null,
      notes: "",
    });
  });

  it("muestra metadata cardio sólo si un snapshot estructurado lo indica", () => {
    const strength = {
      grupo_muscular_snapshot: "pecho" as const,
      muscle_group_label_snapshot: "Pecho",
    };
    const abs = {
      grupo_muscular_snapshot: "abdomen" as const,
      muscle_group_label_snapshot: "Abdomen",
    };
    const cardio = {
      grupo_muscular_snapshot: "cardio" as const,
      muscle_group_label_snapshot: "Cardio",
    };

    expect(sessionHasCardioExercise([strength])).toBe(false); // PUSH / PULL
    expect(sessionHasCardioExercise([abs])).toBe(false); // ABS
    expect(sessionHasCardioExercise([cardio])).toBe(true); // CINTA
    expect(sessionHasCardioExercise([strength, cardio])).toBe(true); // Mixta
    expect(
      sessionHasCardioExercise([
        { grupo_muscular_snapshot: null, muscle_group_label_snapshot: "  Cardio  " },
      ]),
    ).toBe(true);
  });
});
