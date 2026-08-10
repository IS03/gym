import { describe, expect, it } from "vitest";
import { INITIAL_PLAN_COUNTS, INITIAL_TRAINING_PLAN } from "./initial-plan";
import { assertConsecutiveSets } from "./training-validation";

describe("INITIAL_TRAINING_PLAN", () => {
  it("conserva las 3 rutinas, 27 ejercicios y 92 series de la planilla", () => {
    expect(INITIAL_PLAN_COUNTS).toEqual({
      routines: 3,
      exercises: 27,
      sets: 92,
    });
  });

  it("usa identificadores estables únicos", () => {
    const routineKeys = INITIAL_TRAINING_PLAN.routines.map(
      (routine) => routine.source_key,
    );
    const exerciseKeys = INITIAL_TRAINING_PLAN.routines.flatMap((routine) =>
      routine.exercises.map((exercise) => exercise.source_key),
    );
    expect(new Set(routineKeys).size).toBe(routineKeys.length);
    expect(new Set(exerciseKeys).size).toBe(exerciseKeys.length);
  });

  it("numera todas las series consecutivamente", () => {
    for (const routine of INITIAL_TRAINING_PLAN.routines) {
      for (const exercise of routine.exercises) {
        expect(() => assertConsecutiveSets(exercise.sets)).not.toThrow();
      }
    }
  });
});
