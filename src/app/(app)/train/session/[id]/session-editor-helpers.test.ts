import { describe, expect, it } from "vitest";
import {
  completedExerciseSummary,
  completionStats,
  initialExpandedExerciseId,
  renumberWorkoutPayload,
} from "./session-editor-helpers";
import type { WorkoutExercisePayload } from "@/lib/phase2/types";

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
