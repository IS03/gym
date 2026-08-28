import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PR21 database cleanup", () => {
  it("drops only the confirmed duplicate exercise-history index", () => {
    const migration = readFileSync(
      "supabase/migrations/20260827231534_drop_duplicate_workout_session_exercise_index.sql",
      "utf8",
    );

    expect(migration).toContain(
      "drop index if exists public.idx_workout_session_exercises_exercise;",
    );
    expect(migration).toContain(
      "idx_workout_session_exercises_exercise_created",
    );
    expect(migration).not.toContain(
      "drop index if exists public.idx_workout_session_exercises_exercise_created;",
    );
  });
});
