import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ownlevelOAuthAdminRpc } from "./oauth-admin";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
  vi.stubEnv("OWNLEVEL_MCP_RESOURCE", "https://preview.example/mcp");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("OWNLEVEL OAuth admin RPC transport", () => {
  it("uses a server secret only as apikey, never as Authorization bearer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic");
    vi.stubEnv("OWNLEVEL_MCP_RESOURCE", "https://preview.example/mcp");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json("22222222-2222-4222-8222-222222222222"));
    vi.stubGlobal("fetch", fetcher);

    const result = await ownlevelOAuthAdminRpc<string>(
      "ownlevel_oauth_authorization_client",
      { p_authorization_id: "abc", p_user_id: "u", p_resource: "https://preview.example/mcp" },
    );

    expect(result.error).toBeNull();
    expect(result.data).toBe("22222222-2222-4222-8222-222222222222");
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ apikey: "sb_secret_synthetic" });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it.each(["sb_secret_aaaaa\u2022masked", "sb_secret_foo\n", "sb_secret_foo\r", "sb_secret_foo\u0100", "sb_secret_foo\u00a0", "placeholder", ""])(
    "returns a controlled failure for invalid credentials without constructing HTTP headers",
    async (secret) => {
      vi.stubEnv("SUPABASE_SECRET_KEY", secret);
      const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await ownlevelOAuthAdminRpc("ownlevel_oauth_authorization_client", {});
      expect(result).toEqual({ data: null, error: { message: "OAuth configuration unavailable", code: "OAUTH_CONFIGURATION_INVALID" } });
      expect(fetcher).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith("[oauth-config] invalid server credential", expect.objectContaining({
        source: "SUPABASE_SECRET_KEY", exists: true, length: secret.length,
        hasMaskBullet: secret.includes("\u2022"),
        hasNonByteCharacter: [...secret].some((char) => char.codePointAt(0)! > 255),
      }));
      if (secret) expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    },
  );

  it("does not silently use a legacy credential to conceal a broken primary credential", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_aaaaa\u2022masked");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "header.payload.signature");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await ownlevelOAuthAdminRpc("ownlevel_oauth_authorization_client", {})).error?.code).toBe("OAUTH_CONFIGURATION_INVALID");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves the legacy fallback when the primary is absent", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "header.payload.signature");
    const fetcher = vi.fn(async () => Response.json("client")); vi.stubGlobal("fetch", fetcher);
    expect((await ownlevelOAuthAdminRpc("ownlevel_oauth_authorization_client", {})).data).toBe("client");
    expect(fetcher.mock.calls).toHaveLength(1);
  });

  it.each(["throw", "invalid-json", "http-error"])("controls %s failures without leaking upstream messages", async (failure) => {
    const privateText = "private-synthetic-credential-or-request";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "throw") throw new TypeError(privateText);
      if (failure === "invalid-json") return new Response(privateText, { status: 200 });
      return Response.json({ message: privateText, code: privateText }, { status: 401 });
    }));
    const result = await ownlevelOAuthAdminRpc("ownlevel_oauth_authorization_client", {});
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(JSON.stringify({ result, logs: log.mock.calls })).not.toContain(privateText);
  });

  it("rejects arbitrary RPCs without a network request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await ownlevelOAuthAdminRpc("get_every_user", {})).error).not.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
