import { describe, expect, it } from "vitest";
import type { WorkoutSession, WorkoutSessionExercise, WorkoutSet } from "@/lib/phase2/types";
import { summarizeDailyHistorySessions } from "./daily-history-core";

function session(id: string, status: WorkoutSession["status"] = "completed"): WorkoutSession {
  return { id, user_id: "u", day_log_id: "d", routine_id: null, routine_name_snapshot: id, session_name: null, status, started_at: "2026-08-20T12:00:00Z", ended_at: "2026-08-20T13:15:00Z", energy_level: null, performance_level: null, pain_level: null, pain_note: null, abs_completed: false, treadmill_minutes: null, treadmill_distance_km: null, treadmill_speed_kmh: null, treadmill_incline_percent: null, notes: null, created_at: "", updated_at: "" };
}
function exercise(id: string, workoutSessionId: string): WorkoutSessionExercise { return { id, user_id: "u", workout_session_id: workoutSessionId, routine_exercise_id: null, exercise_id: "e", exercise_order: 1, source_type: "routine", nombre_snapshot: "Press", grupo_muscular_snapshot: null, muscle_group_label_snapshot: null, implement_snapshot: null, weight_mode_snapshot: null, rest_min_seconds_snapshot: null, rest_max_seconds_snapshot: null, planned_sets_count: 2, next_adjustment_snapshot: "maintain", next_adjustment_note_snapshot: null, decision: "maintain", decision_note: null, apply_to_routine: false, routine_note_snapshot: null, notes: null, series_reales: null, reps_reales: null, peso_real: null, is_completed: true, completed_at: null, created_at: "", updated_at: "" }; }
function set(id: string, exerciseId: string, completed: boolean, reps = 10, weight = 20): WorkoutSet { return { id, user_id: "u", workout_session_exercise_id: exerciseId, set_number: 1, target_reps: null, target_weight_kg: null, target_rir: null, actual_reps: reps, actual_weight_kg: weight, is_completed: completed, completed_at: null, notes: null, created_at: "", updated_at: "" }; }

describe("daily history session summaries", () => {
  it("incluye múltiples completed y excluye in_progress/discarded", () => {
    const result = summarizeDailyHistorySessions({ sessions: [session("push"), session("pull"), session("draft", "in_progress"), session("discard", "discarded")], exercises: [exercise("e1", "push"), exercise("e2", "pull")], sets: [set("s1", "e1", true), set("s2", "e2", true)] });
    expect(result.map((item) => item.id)).toEqual(["push", "pull"]);
  });

  it("cuenta sólo series realizadas y aplica la misma fórmula de volumen de Progress", () => {
    const result = summarizeDailyHistorySessions({ sessions: [session("push")], exercises: [exercise("e1", "push"), exercise("e2", "push")], sets: [set("s1", "e1", true, 10, 20), set("s2", "e1", false, 12, 30), set("s3", "e2", true, 8, 25)] });
    expect(result[0]).toMatchObject({ completedSets: 2, completedExercises: 2, volumeKg: 400, durationMilliseconds: 4_500_000 });
  });

  it("no inventa duración cuando faltan timestamps", () => {
    const item = session("push");
    item.ended_at = null;
    expect(summarizeDailyHistorySessions({ sessions: [item], exercises: [], sets: [] })[0].durationMilliseconds).toBeNull();
  });
});
