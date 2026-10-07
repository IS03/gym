import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleOAuthRequest } from "@/lib/security/google-oauth";

const mocks = vi.hoisted(() => ({ exchange: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
import { GET } from "./route";

const origin = "https://preview.example";
const next = "/oauth/consent?authorization_id=synthetic_pending_request";
const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic-public");
  mocks.exchange.mockReset().mockResolvedValue({ error: null });
  mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google callback preserves pending OAuth consent", () => {
  it("keeps the URL authorization_id through Google, callback and successful login", async () => {
    expect(googleOAuthRequest(origin, next).options.redirectTo).toBe(callback);
    const response = await GET(new Request(`${callback}&code=synthetic_google_code`));
    expect(response.headers.get("location")).toBe(`${origin}${next}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["missing-code", "missing-config", "rejected", "thrown"])("keeps next on %s so login retries preserve authorization_id", async (failure) => {
    if (failure === "missing-config") vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    if (failure === "rejected") mocks.exchange.mockResolvedValue({ error: new Error("synthetic") });
    if (failure === "thrown") mocks.exchange.mockRejectedValue(new Error("synthetic"));
    const request = new Request(callback + (failure === "missing-code" ? "" : "&code=synthetic"));
    const response = await GET(request);
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("next")).toBe(next);
    expect(destination.searchParams.get("error")).toBe("auth");
    expect(googleOAuthRequest(origin, destination.searchParams.get("next")!).options.redirectTo).toBe(callback);
  });

  it("preserves the existing /home callback for ordinary login", async () => {
    expect((await GET(new Request(`${origin}/auth/callback?code=synthetic`))).headers.get("location")).toBe(`${origin}/home`);
    expect((await GET(new Request(`${origin}/auth/callback`))).headers.get("location")).toBe(`${origin}/login?error=auth`);
  });

  it("still forbids an external next on successful and failed login", async () => {
    const request = new Request(`${origin}/auth/callback?code=synthetic&next=${encodeURIComponent("//evil.example")}`);
    expect((await GET(request)).headers.get("location")).toBe(`${origin}/home`);
    mocks.exchange.mockResolvedValue({ error: new Error("synthetic") });
    expect((await GET(request)).headers.get("location")).toBe(`${origin}/login?error=auth`);
  });
});
