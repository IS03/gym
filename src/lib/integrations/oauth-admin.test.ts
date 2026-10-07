import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ownlevelOAuthAdminRpc } from "./oauth-admin";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OWNLEVEL OAuth admin RPC transport", () => {
  it("uses a server secret only as apikey, never as Authorization bearer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_synthetic");
    vi.stubEnv("OWNLEVEL_MCP_RESOURCE", "https://preview.example/mcp");
    const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
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
});
