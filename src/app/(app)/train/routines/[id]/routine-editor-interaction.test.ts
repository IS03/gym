import { describe, expect, it } from "vitest";
import {
  canMutateRoutineStructure,
  filterRoutinePickerExercises,
  nextExpandedRoutineExerciseId,
  shouldShowRoutineExerciseSectionAddAction,
  toggleRoutineNextAdjustment,
} from "./routine-editor-interaction";

describe("routine editor v2 interactions", () => {
  it("keeps one exercise open and lets the current one collapse", () => {
    expect(nextExpandedRoutineExerciseId(null, "a")).toBe("a");
    expect(nextExpandedRoutineExerciseId("a", "b")).toBe("b");
    expect(nextExpandedRoutineExerciseId("b", "b")).toBeNull();
  });

  it("blocks structural mutations while explicit targets are dirty", () => {
    expect(canMutateRoutineStructure(0)).toBe(true);
    expect(canMutateRoutineStructure(1)).toBe(false);
  });

  it("keeps the section action out of the empty state", () => {
    expect(shouldShowRoutineExerciseSectionAddAction(0)).toBe(false);
    expect(shouldShowRoutineExerciseSectionAddAction(1)).toBe(true);
  });

  it("toggles the two supported next-time adjustments without producing legacy custom", () => {
    expect(toggleRoutineNextAdjustment("maintain", "increase_weight")).toBe("increase_weight");
    expect(toggleRoutineNextAdjustment("increase_weight", "increase_weight")).toBe("maintain");
    expect(toggleRoutineNextAdjustment("maintain", "increase_reps")).toBe("increase_reps");
    expect(toggleRoutineNextAdjustment("increase_reps", "increase_reps")).toBe("maintain");
    expect(toggleRoutineNextAdjustment("increase_weight", "increase_reps")).toBe("increase_reps");
    expect(toggleRoutineNextAdjustment("increase_reps", "increase_weight")).toBe("increase_weight");
  });

  it("replaces legacy custom only when the user chooses a supported toggle", () => {
    expect(toggleRoutineNextAdjustment("custom", "increase_weight")).toBe("increase_weight");
    expect(toggleRoutineNextAdjustment("custom", "increase_reps")).toBe("increase_reps");
  });

  it("filters unavailable exercises without owning or clearing selection", () => {
    const exercises = [
      { id: "press", nombre: "Press máquina", grupo_muscular: "pecho" as const },
      { id: "jalon", nombre: "Jalón", grupo_muscular: "espalda" as const },
      { id: "curl", nombre: "Curl", grupo_muscular: "bíceps" as const },
    ];

    expect(
      filterRoutinePickerExercises(exercises, new Set(["press"]), "espalda", "ja"),
    ).toEqual([exercises[1]]);
    expect(
      filterRoutinePickerExercises(exercises, new Set(["press"]), "pecho", ""),
    ).toEqual([]);
  });
});
