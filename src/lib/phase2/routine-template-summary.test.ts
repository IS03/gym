import { describe, expect, it } from "vitest";
import { summarizeRoutineExerciseTarget } from "./routine-template-summary";

function summary(sets: Array<{ reps: number | null; weight: number | null; rir: number | null }>) {
  return summarizeRoutineExerciseTarget({
    sets: sets.map((set, index) => ({
      set_number: index + 1,
      target_reps: set.reps,
      target_weight_kg: set.weight,
      target_rir: set.rir,
      notes: null,
    })),
  });
}

describe("resumen compacto de objetivos de rutina", () => {
  it("resume sets uniformes sin inventar datos", () => {
    expect(summary([{ reps: 10, weight: 85, rir: 2 }, { reps: 10, weight: 85, rir: 2 }])).toEqual({
      setLabel: "2 series",
      signals: ["85 kg", "RIR 2"],
    });
  });

  it("marca carga y RIR variables", () => {
    expect(summary([{ reps: 10, weight: 80, rir: 1 }, { reps: 8, weight: 85, rir: 2 }])).toEqual({
      setLabel: "2 series",
      signals: ["carga variable", "RIR variable"],
    });
  });

  it("maneja una sola serie y valores desconocidos", () => {
    expect(summary([{ reps: 12, weight: 20, rir: 3 }])).toEqual({
      setLabel: "1 serie",
      signals: ["20 kg", "RIR 3"],
    });
    expect(summary([{ reps: null, weight: null, rir: null }])).toEqual({
      setLabel: "1 serie",
      signals: [],
    });
  });
});
