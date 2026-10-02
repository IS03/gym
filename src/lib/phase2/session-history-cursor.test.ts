import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { listCompletedSessionHistory } from "./training-robust";
import type { AuthenticatedRequestContext } from "../supabase/server";

// Records the PostgREST chain per table; every chain resolves to that table's rows.
function fakeContext(rows: Record<string, unknown[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "not", "order", "or", "in", "limit"]) {
      builder[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return builder; };
    }
    builder.then = (resolve: (value: unknown) => void) => resolve({ data: rows[table] ?? [], error: null });
    return builder;
  };
  return { calls, context: { supabase: { from }, userId: "owner" } as unknown as AuthenticatedRequestContext };
}

describe("completed session history keyset", () => {
  it("orders by (ended_at, id) desc and applies the verbatim cursor only when present", async () => {
    const endedAt = "2026-10-01T10:00:00.123456+00:00", id = "34100000-0000-4000-8000-000000000001";
    const session = { id: "34100000-0000-4000-8000-000000000002", user_id: "owner", day_log_id: "day", routine_id: null,
      routine_name_snapshot: null, session_name: "Libre", status: "completed", started_at: "2026-09-30T10:00:00+00:00",
      ended_at: "2026-09-30T11:00:00.000001+00:00", routine: null };
    const { calls, context } = fakeContext({ workout_sessions: [session], day_logs: [{ id: "day", log_date: "2026-09-30" }] });
    const result = await listCompletedSessionHistory({ limit: 3, before: { endedAt, id } }, context);
    const sessionCalls = calls.filter((call) => call.table === "workout_sessions");
    expect(sessionCalls.filter((call) => call.method === "order").map((call) => call.args)).toEqual([
      ["ended_at", { ascending: false }], ["id", { ascending: false }]]);
    expect(sessionCalls.find((call) => call.method === "or")?.args).toEqual([`ended_at.lt."${endedAt}",and(ended_at.eq."${endedAt}",id.lt.${id})`]);
    expect(sessionCalls).toContainEqual({ table: "workout_sessions", method: "eq", args: ["user_id", "owner"] });
    expect(sessionCalls).toContainEqual({ table: "workout_sessions", method: "eq", args: ["status", "completed"] });
    expect(result).toEqual([expect.objectContaining({ id: session.id, endedAt: session.ended_at, logDate: "2026-09-30", routineName: "Libre" })]);
    const web = fakeContext({ workout_sessions: [] });
    expect(await listCompletedSessionHistory({ limit: 3 }, web.context)).toEqual([]);
    expect(web.calls.some((call) => call.method === "or")).toBe(false);
  });
});
