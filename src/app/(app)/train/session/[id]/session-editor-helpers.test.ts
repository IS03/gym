import { describe, expect, it } from "vitest";
import { completionStats, renumberWorkoutPayload } from "./session-editor-helpers";
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

  it("resume únicamente series marcadas", () => {
    expect(completionStats([payload()])).toEqual({
      completedSets: 1,
      totalSets: 2,
      completedExercises: 1,
    });
  });
});
