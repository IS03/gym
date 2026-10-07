import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
import { createOAuthMealGate } from "./oauth-auth";

const resource = "https://www.ownlevel.fit/mcp";
const issuer = "https://synthetic.supabase.co/auth/v1";
const user = "11111111-1111-4111-8111-111111111111";
const client = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
const grant = "44444444-4444-4444-8444-444444444444";
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: { keys: Awaited<ReturnType<typeof exportJWK>>[] };
const handler = vi.fn(async () => new Response("saved"));
const claims = () => ({ iss: issuer, aud: resource, sub: user,
  exp: Math.floor(Date.now() / 1000) + 300, role: "authenticated", is_anonymous: false,
  client_id: client, session_id: session, ownlevel_grant_id: grant,
  ownlevel_permissions: ["meals:write"] });
async function invoke(overrides: Record<string, unknown> = {}, signingKey = keys.privateKey) {
  const token = await new SignJWT({ ...claims(), ...overrides })
    .setProtectedHeader({ alg: "ES256", kid: "synthetic" }).sign(signingKey);
  const gate = createOAuthMealGate({ resource, metadataUrl: `${resource}/oauth-protected-resource`, issuer,
    env: { url: "https://synthetic.supabase.co", publishableKeys: { default: "synthetic-public" },
      secretKeys: { default: "synthetic-secret" }, jwks } }, handler);
  return gate(new Request(resource, { headers: { Authorization: `Bearer ${token}` } }));
}
beforeAll(async () => {
  keys = await generateKeyPair("ES256", { extractable: true });
  jwks = { keys: [{ ...await exportJWK(keys.publicKey), kid: "synthetic", alg: "ES256" }] };
});
beforeEach(() => {
  vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: true, error: null });
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    if (!String(url).endsWith("/rest/v1/rpc/ownlevel_oauth_access_allowed")) throw new Error("Unexpected test network request");
    const result = await mocks.rpc("ownlevel_oauth_access_allowed", JSON.parse(options.body as string));
    return Response.json(result.error ?? result.data, { status: result.error ? 503 : 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("OWNLEVEL OAuth: standard JWT validation plus current DB permission", () => {
  it("verifies an ES256 token and binds every identity value to signed claims", async () => {
    expect((await invoke()).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("ownlevel_oauth_access_allowed", {
      p_user_id: user, p_client_id: client, p_session_id: session, p_grant_id: grant, p_resource: resource,
    });
    expect(handler).toHaveBeenCalledOnce();
  });
  it.each([
    ["wrong issuer", { iss: "https://other.supabase.co/auth/v1" }],
    ["wrong audience", { aud: "authenticated" }],
    ["expired", { exp: 1 }],
    ["not yet valid", { nbf: Math.floor(Date.now() / 1000) + 600 }],
  ])("rejects %s before checking permissions", async (_name, overrides) => {
    expect((await invoke(overrides)).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects a foreign signature", async () => {
    const foreign = await generateKeyPair("ES256");
    expect((await invoke({}, foreign.privateKey)).status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
  it.each([
    ["missing expiry", { exp: undefined }], ["missing client", { client_id: undefined }],
    ["anonymous user", { is_anonymous: true }], ["missing permission", { ownlevel_permissions: [] }],
    ["missing grant", { ownlevel_grant_id: undefined }], ["missing session", { session_id: undefined }],
  ])("rejects %s even with a valid signature", async (_name, overrides) => {
    expect((await invoke(overrides)).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it("rejects a revoked grant, unauthorized client or deleted session immediately", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(response.headers.get("WWW-Authenticate")).toContain("insufficient_scope");
    expect(handler).not.toHaveBeenCalled();
  });
  it("fails closed when the permission database is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await invoke()).status).toBe(503);
    expect(handler).not.toHaveBeenCalled();
  });
});
