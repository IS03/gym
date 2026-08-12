import { describe, expect, it } from "vitest";
import {
  nullableNumberFromInput,
  validateCompletedSessionCorrection,
  validateRoutineExercisePayload,
  validateWorkoutExercisePayload,
} from "./training-validation";
import type { WorkoutExercisePayload } from "./types";

function payload(): WorkoutExercisePayload {
  return {
    is_completed: true,
    decision: "maintain",
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
    ],
  };
}

describe("validación de entrenamiento", () => {
  it("rechaza series salteadas", () => {
    const value = payload();
    value.sets.push({ ...value.sets[0], set_number: 3 });
    expect(() => validateWorkoutExercisePayload(value)).toThrow(
      "numeradas en orden",
    );
  });

  it("rechaza marcar una serie sin repeticiones reales", () => {
    const value = payload();
    value.sets[0].actual_reps = null;
    expect(() => validateWorkoutExercisePayload(value)).toThrow(
      "Completá las repeticiones",
    );
  });

  it("acepta coma decimal en entradas móviles", () => {
    expect(nullableNumberFromInput("12,5")).toBe(12.5);
    expect(nullableNumberFromInput("")).toBeNull();
  });

  it("rechaza un descanso mínimo mayor al máximo", () => {
    expect(() =>
      validateRoutineExercisePayload({
        next_adjustment: "maintain",
        rest_min_seconds: 120,
        rest_max_seconds: 90,
        notes: "",
        sets: [
          {
            set_number: 1,
            target_reps: 10,
            target_weight_kg: 20,
            target_rir: 1,
            notes: null,
          },
        ],
      }),
    ).toThrow("descanso mínimo");
  });

  it("acepta correcciones sólo de valores realizados y rechaza números inválidos", () => {
    const input = {
      sessionId: "session-1",
      expectedSessionUpdatedAt: "2026-08-11T17:00:00.000Z",
      metadata: { energy_level: null, performance_level: null, pain_level: null, pain_note: "", treadmill_minutes: null, treadmill_distance_km: null, treadmill_speed_kmh: null, treadmill_incline_percent: null, notes: "" },
      exercises: [{ id: "exercise-1", expectedUpdatedAt: "2026-08-11T17:00:00.000Z", notes: "", sets: [{ id: "set-1", actual_reps: 10, actual_weight_kg: 52, notes: "" }] }],
    };
    expect(() => validateCompletedSessionCorrection(input)).not.toThrow();
    input.exercises[0].sets[0].actual_reps = 10.5;
    expect(() => validateCompletedSessionCorrection(input)).toThrow("entero");
  });
});
