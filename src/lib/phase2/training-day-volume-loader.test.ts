import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/phase2/training-robust.ts", "utf8");

describe("carga histórica del volumen diario", () => {
  it("reutiliza una única carga agrupada de series completadas", () => {
    expect(source).toContain(
      '.select("workout_session_exercise_id, actual_reps, actual_weight_kg")',
    );
    expect(source).toContain('.eq("is_completed", true)');
    expect(source).toContain("completedSetRowsBySession");
    expect(source).toContain("volumeKg: summarizeTrainingSessionVolume(");
    expect(source).toContain("completedSetRowsBySession.get(session.id) ?? []");
  });
});
