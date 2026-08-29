import { describe, expect, it } from "vitest";
import {
  canMutateRoutineStructure,
  filterRoutinePickerExercises,
  nextExpandedRoutineExerciseId,
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
