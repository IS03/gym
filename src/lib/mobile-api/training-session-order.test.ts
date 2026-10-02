import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleMobileMutationRequest } from "./auth";
import { parseSessionExerciseOrder, parseSessionExerciseOrderResponse } from "./training-session";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ authenticateMobileMutationAccessToken: mocks.authenticate }));
import { reorderMobileSessionExercises } from "./training-session-server";
import { PUT, OPTIONS } from "../../app/api/mobile/v1/training/sessions/[sessionId]/exercise-order/route";
const sessionId = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222", second = "33333333-3333-4333-8333-333333333333";
const version = "2026-10-01T12:00:00.123456+00:00", next = "2026-10-01T12:00:01.123457+00:00";
const input = { orderedSessionExerciseIds: [second, first], expectedSessionUpdatedAt: version, idempotencyKey: "order:1" };
const response = { status: "reordered" as const, sessionId, sessionUpdatedAt: next, orderedSessionExerciseIds: [second, first] };
function context(rpc = vi.fn()) { return { userId: "bearer-owner", supabase: { rpc } } as unknown as MobileSupabaseAuthenticatedContext; }
const request = (body = input, authorization = "Bearer token") => new NextRequest("https://example.test/api/mobile/v1/training/sessions/session/exercise-order", {
  method: "PUT", headers: { authorization, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
describe("M3.3D exercise-order contracts/adapters", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("accepts only the order intent, preserving opaque CAS precision and empty-session order", () => {
    expect(parseSessionExerciseOrder(input)).toEqual(input);
    const upper = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    expect(parseSessionExerciseOrder({ ...input, orderedSessionExerciseIds: [upper] }).orderedSessionExerciseIds).toEqual([upper.toLowerCase()]);
    expect(() => parseSessionExerciseOrder({ ...input, orderedSessionExerciseIds: [upper, upper.toLowerCase()] })).toThrow();
    expect(parseSessionExerciseOrder({ ...input, orderedSessionExerciseIds: [] }).orderedSessionExerciseIds).toEqual([]);
    for (const invalid of [
      { ...input, userId: "attacker" }, { ...input, payload: {} }, { ...input, orderedSessionExerciseIds: [first, first] },
      { ...input, orderedSessionExerciseIds: [null] }, { ...input, orderedSessionExerciseIds: [[first]] },
      { ...input, orderedSessionExerciseIds: "not-array" }, { ...input, expectedSessionUpdatedAt: "2026-02-30T12:00:00Z" },
      { ...input, idempotencyKey: "invalid key" }, { ...input, orderedSessionExerciseIds: Array(10001).fill(first) },
    ]) expect(() => parseSessionExerciseOrder(invalid)).toThrow();
    expect(parseSessionExerciseOrderResponse(response)).toEqual(response);
  });
  it.each([false, true])("returns exact server truth for initial response/replay=%s", async replayed => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ response_status: 200, response_body: response, replayed }], error: null });
    expect(await reorderMobileSessionExercises(sessionId, input, context(rpc))).toEqual(response);
    expect(rpc).toHaveBeenCalledWith("mobile_reorder_workout_exercises", { p_session_id: sessionId,
      p_ordered_session_exercise_ids: [second, first], p_expected_session_updated_at: version, p_idempotency_key: "order:1" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("maps stale/closed/missing/key mismatch errors explicitly and never blindly retries", async () => {
    const rpc = vi.fn();
    for (const [message, code, status, expected] of [
      ["SESSION_CHANGED", "PT409", 409, "SESSION_CHANGED"], ["SESSION_CLOSED", "P0001", 409, "SESSION_CLOSED"],
      ["TRAINING_SESSION_NOT_FOUND", "P0002", 404, "NOT_FOUND"], ["IDEMPOTENCY_KEY_REUSED", "PT409", 409, "IDEMPOTENCY_KEY_REUSED"],
      ["invalid set", "22023", 400, "VALIDATION_ERROR"], ["timeout", "57014", 503, "DATA_UNAVAILABLE"],
    ] as const) {
      rpc.mockResolvedValue({ data: null, error: { message, code } });
      const result = await handleMobileMutationRequest("Bearer token", { authenticate: async () => context(rpc),
        mutate: ctx => reorderMobileSessionExercises(sessionId, input, ctx) });
      expect(result).toMatchObject({ status, body: { error: expected } });
    }
    expect(rpc).toHaveBeenCalledTimes(6);
  });
  it("rejects malformed/mismatched persisted responses as unavailable, not client validation", async () => {
    const rpc = vi.fn();
    for (const body of [{ ...response, sessionId: first }, { ...response, sessionUpdatedAt: "invalid" },
      { ...response, orderedSessionExerciseIds: [first, second] }, { ...response, orderedSessionExerciseIds: [second, second] },
      { ...response, payload: {} }]) {
      rpc.mockResolvedValue({ data: [{ response_status: 200, response_body: body, replayed: true }], error: null });
      const result = await handleMobileMutationRequest("Bearer token", { authenticate: async () => context(rpc), mutate: ctx => reorderMobileSessionExercises(sessionId, input, ctx) });
      expect(result).toMatchObject({ status: 503 });
    }
  });
  it("authenticates PUT using mutation context and emits private no-store response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ response_status: 200, response_body: response, replayed: false }], error: null });
    mocks.authenticate.mockResolvedValue(context(rpc));
    const route = { params: Promise.resolve({ sessionId }) };
    const result = await PUT(request(), route);
    expect(result.status).toBe(200); expect(await result.json()).toEqual(response); expect(result.headers.get("cache-control")).toBe("no-store");
    expect(mocks.authenticate).toHaveBeenCalledWith("token");
    expect((await PUT(request(input, ""), route)).status).toBe(401); expect(rpc).toHaveBeenCalledTimes(1);
    expect(OPTIONS(request()).status).toBe(204);
  });
});
describe("M3.3D migration contract", () => {
  const sql = readFileSync("supabase/migrations/20261001010000_active_session_exercise_order.sql", "utf8");
  it("preserves exercise CAS on pure order changes and advances parent CAS for shared membership mutations", () => {
    expect(sql).toContain("to_jsonb(new) - 'exercise_order' - 'updated_at'");
    expect(sql).toContain("new.updated_at := old.updated_at");
    expect(sql).toContain("public.append_workout_exercise(uuid,uuid,text)");
    expect(sql).toContain("public.remove_workout_exercise(uuid,uuid,timestamptz)");
    expect(sql).toContain("old.updated_at + interval '1 microsecond'");
    expect(sql).not.toMatch(/create table|add column|delete from public\.workout_session_exercises|insert into public\.workout_session_exercises/);
  });
  it("derives ownership, checks exact membership, serializes locks and scopes/replays the existing ledger", () => {
    const rpc = sql.slice(sql.indexOf("create or replace function public.mobile_reorder_workout_exercises"));
    expect(rpc.indexOf("lock_training_user_mutations()")).toBeLessThan(rpc.indexOf("for update"));
    expect(rpc.indexOf("lock_active_workout_session(p_session_id)")).toBeLessThan(rpc.indexOf("order by id for update"));
    expect(rpc.indexOf("v_ledger.state = 'completed'")).toBeLessThan(rpc.indexOf("lock_active_workout_session(p_session_id)"));
    expect(rpc).toContain("count(distinct id)"); expect(rpc).toContain("cardinality(p_ordered_session_exercise_ids) <> v_count");
    expect(rpc).toContain("se.workout_session_id = p_session_id and se.user_id = v_user_id");
    expect(rpc).toContain("errcode = 'PT409', message = 'SESSION_CHANGED'");
    expect(rpc).toContain("array_agg(id order by exercise_order)");
    expect(rpc).toContain("grant execute on function public.mobile_reorder_workout_exercises(uuid,uuid[],timestamptz,text) to authenticated");
    expect(rpc).not.toContain("p_user_id"); expect(rpc).not.toContain("service_role");
  });
});
