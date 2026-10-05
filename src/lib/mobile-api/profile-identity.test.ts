import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ authenticateMobileMutationAccessToken: vi.fn() }));
import { authenticateMobileMutationAccessToken } from "./supabase";
import { GET, PATCH } from "@/app/api/mobile/v1/profile/route";
import { normalizeDisplayName, parseDisplayNameIntent, parseDisplayNameReceipt, parseProfileIdentity } from "./profile-identity-contract";

const v1 = "a".repeat(64), v2 = "b".repeat(64);
const rpc = vi.fn();
const request = (method = "GET", body?: unknown, token = "Bearer token") => new NextRequest("https://www.ownlevel.fit/api/mobile/v1/profile",
  { method, headers: { authorization: token, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const row = (status: number, body: unknown, replayed = false) => ({ data: [{ response_status: status, response_body: body, replayed }], error: null });
const intent = { displayName: "Nacho", expectedVersion: v1, idempotencyKey: "display-name:1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticateMobileMutationAccessToken).mockImplementation(async (token: string) => {
    if (!token) { const { MobileApiUnauthorizedError } = await import("./auth"); throw new MobileApiUnauthorizedError(); }
    return { userId: "owner", supabase: { rpc } } as never;
  });
});

describe("M8 display name contract", () => {
  it("normalizes like Web: trimmed, blank = null, no length/character rules", () => {
    expect(normalizeDisplayName("  Nacho  ")).toBe("Nacho");
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("")).toBeNull();
    expect(normalizeDisplayName("Ñandú 🏋️ ".repeat(40))?.length).toBeGreaterThan(200);
  });
  it("accepts only normalized intents with exact keys (never a user id)", () => {
    expect(parseDisplayNameIntent(intent)).toEqual(intent);
    expect(parseDisplayNameIntent({ ...intent, displayName: null })).toEqual({ ...intent, displayName: null });
    for (const bad of [{ ...intent, displayName: " Nacho" }, { ...intent, displayName: "" }, { ...intent, displayName: 3 },
      { ...intent, expectedVersion: "x" }, { ...intent, idempotencyKey: "bad key" }, { ...intent, userId: "other" }, { displayName: "Nacho" }]) {
      expect(parseDisplayNameIntent(bad)).toBeUndefined();
    }
  });
  it("shows stored truth as-is and validates receipts", () => {
    expect(parseProfileIdentity({ displayName: " legacy ", version: v1 })).toEqual({ displayName: " legacy ", version: v1 });
    expect(parseProfileIdentity({ displayName: null, version: v1 })).toEqual({ displayName: null, version: v1 });
    expect(parseProfileIdentity({ displayName: "x", version: v1, userId: "owner" })).toBeUndefined();
    expect(parseDisplayNameReceipt({ status: "confirmed", displayName: "Nacho", version: v2 })).toBeDefined();
    expect(parseDisplayNameReceipt({ status: "confirmed", displayName: "", version: v2 })).toBeUndefined();
  });
});

describe("M8 /api/mobile/v1/profile", () => {
  it("reads the caller's identity through the owner-scoped RPC", async () => {
    rpc.mockResolvedValue({ data: { displayName: "Nacho", version: v1 }, error: null });
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ displayName: "Nacho", version: v1 });
    expect(authenticateMobileMutationAccessToken).toHaveBeenCalledWith("token");
    expect(rpc).toHaveBeenCalledWith("mobile_read_profile_identity", {}, { get: true });
  });
  it("is unavailable (not empty) on an invalid read and 401 without Bearer", async () => {
    rpc.mockResolvedValue({ data: { displayName: "Nacho" }, error: null });
    expect((await GET(request())).status).toBe(503);
    rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await GET(request())).status).toBe(503);
    expect((await GET(request("GET", undefined, ""))).status).toBe(401);
  });
  it("writes only the parsed intent (no user id) and returns the receipt", async () => {
    rpc.mockResolvedValue(row(200, { status: "confirmed", displayName: "Nacho", version: v2 }));
    const res = await PATCH(request("PATCH", intent));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "confirmed", displayName: "Nacho", version: v2 });
    expect(rpc).toHaveBeenCalledWith("mobile_update_profile_display_name", { p_intent: intent });
  });
  it("replays an idempotent receipt unchanged", async () => {
    rpc.mockResolvedValue(row(200, { status: "confirmed", displayName: "Nacho", version: v2 }, true));
    const res = await PATCH(request("PATCH", intent));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "confirmed", displayName: "Nacho", version: v2 });
  });
  it("surfaces stale version and same-key-different-payload as explicit conflicts", async () => {
    rpc.mockResolvedValue(row(409, { error: "PROFILE_CHANGED", message: "Tu nombre cambió." }));
    let res = await PATCH(request("PATCH", intent));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "PROFILE_CHANGED", message: "Tu nombre cambió." });
    rpc.mockResolvedValue(row(409, { error: "IDEMPOTENCY_KEY_REUSED", message: "El intento ya tiene otros datos." }));
    res = await PATCH(request("PATCH", { ...intent, displayName: "Otro" }));
    expect((await res.json()).error).toBe("IDEMPOTENCY_KEY_REUSED");
  });
  it("rejects non-normalized or foreign-owner bodies before reaching the database", async () => {
    for (const body of [{ ...intent, displayName: " Nacho " }, { ...intent, userId: "other" }, "x"]) {
      expect((await PATCH(request("PATCH", body))).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps database validation to 400 and anything unexpected to 503 (uncertain, never success)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
    expect((await PATCH(request("PATCH", intent))).status).toBe(400);
    rpc.mockResolvedValue({ data: null, error: { code: "57014" } });
    expect((await PATCH(request("PATCH", intent))).status).toBe(503);
    rpc.mockResolvedValue(row(409, { error: "SOMETHING_ELSE", message: "x" }));
    expect((await PATCH(request("PATCH", intent))).status).toBe(503);
    rpc.mockResolvedValue(row(200, { status: "confirmed", displayName: " Nacho", version: v2 }));
    expect((await PATCH(request("PATCH", intent))).status).toBe(503);
  });
});
