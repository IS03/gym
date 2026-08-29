import { describe, expect, it } from "vitest";
import { summarizeRoutineExerciseTarget } from "./routine-template-summary";

function summary(
  sets: Array<{ reps: number | null; weight: number | null; rir: number | null }>,
  nextAdjustment: "maintain" | "increase_weight" | "increase_reps" | "custom" = "maintain",
) {
  return summarizeRoutineExerciseTarget({
    next_adjustment: nextAdjustment,
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
      adjustmentLabel: null,
    });
  });

  it("marca carga y RIR variables", () => {
    expect(summary([{ reps: 10, weight: 80, rir: 1 }, { reps: 8, weight: 85, rir: 2 }])).toEqual({
      setLabel: "2 series",
      signals: ["carga variable", "RIR variable"],
      adjustmentLabel: null,
    });
  });

  it("maneja una sola serie y valores desconocidos", () => {
    expect(summary([{ reps: 12, weight: 20, rir: 3 }])).toEqual({
      setLabel: "1 serie",
      signals: ["20 kg", "RIR 3"],
      adjustmentLabel: null,
    });
    expect(summary([{ reps: null, weight: null, rir: null }])).toEqual({
      setLabel: "1 serie",
      signals: [],
      adjustmentLabel: null,
    });
  });

  it("keeps future adjustment signals honest, including legacy custom", () => {
    const sets = [{ reps: 10, weight: 40, rir: 2 }];

    expect(summary(sets, "increase_weight").adjustmentLabel).toBe("+ Peso");
    expect(summary(sets, "increase_reps").adjustmentLabel).toBe("+ Repeticiones");
    expect(summary(sets, "custom").adjustmentLabel).toBe("Ajuste personalizado");
  });
});
