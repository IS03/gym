import { describe, expect, it } from "vitest";
import {
  nullableNumberFromInput,
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
});
