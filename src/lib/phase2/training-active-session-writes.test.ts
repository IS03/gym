import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }),
  requireAuthenticatedRequestContext: async () => ({ userId: "owner", supabase: { rpc: mocks.rpc } }),
}));
import { saveWorkoutExercise, cancelWorkoutSession, WorkoutSaveError } from "./training-robust";
import { removeSessionExercise } from "./training";
const timestamp = "2026-09-29T12:00:00.123456+00:00";
const payload = { is_completed: true, decision: "maintain" as const, decision_note: "", apply_to_routine: false, notes: "",
  sets: [{ set_number: 1, target_reps: 8, target_weight_kg: 40, target_rir: 2, actual_reps: 8, actual_weight_kg: null, is_completed: true, notes: null }] };
describe("M3.3B Web adoption of shared active-session primitives", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); });
  it("keeps exercise CAS on the shared save RPC and does not round its token", async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: timestamp, error: null });
    mocks.rpc.mockReturnValue({ abortSignal });
    expect(await saveWorkoutExercise({ sessionExerciseId: "exercise", expectedUpdatedAt: timestamp, payload })).toBe(timestamp);
    expect(mocks.rpc).toHaveBeenCalledWith("save_workout_exercise", { p_session_exercise_id: "exercise", p_expected_updated_at: timestamp, p_payload: payload });
  });
  it.each([
    ["40001", "SESSION_EXERCISE_CHANGED", "conflict"], ["P0001", "SESSION_CLOSED", "session_closed"],
    ["P0001", "SESSION_EXERCISE_REMOVED", "removed"], ["P0002", "TRAINING_SESSION_NOT_FOUND", "removed"],
    ["55P03", "lock timeout", "timeout"], ["22023", "invalid", "validation"],
  ])("maps shared Web write error %s/%s to %s", async (code, message, category) => {
    mocks.rpc.mockReturnValue({ abortSignal: async () => ({ data: null, error: { code, message } }) });
    await expect(saveWorkoutExercise({ sessionExerciseId: "exercise", expectedUpdatedAt: timestamp, payload }))
      .rejects.toMatchObject({ name: "WorkoutSaveError", category });
  });
  it("routes Web remove through parent/association/CAS and cancel through the same lock domain", async () => {
    mocks.rpc.mockResolvedValue({ data: "id", error: null });
    await removeSessionExercise({ id: "exercise", sessionId: "session", expectedUpdatedAt: timestamp });
    expect(mocks.rpc).toHaveBeenCalledWith("remove_workout_exercise", { p_session_id: "session", p_session_exercise_id: "exercise", p_expected_updated_at: timestamp });
    await cancelWorkoutSession("session");
    expect(mocks.rpc).toHaveBeenLastCalledWith("cancel_workout_session", { p_session_id: "session" });
  });
  it("keeps local validation separate from database failures", async () => {
    await expect(saveWorkoutExercise({ sessionExerciseId: "exercise", expectedUpdatedAt: timestamp, payload: { ...payload, sets: [] } })).rejects.toBeInstanceOf(WorkoutSaveError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
