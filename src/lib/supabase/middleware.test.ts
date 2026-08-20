import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: mocks.getClaims },
  })),
}));

import { updateSession } from "./middleware";

describe("updateSession redirects", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    mocks.getClaims.mockReset();
  });

  it("keeps unauthenticated protected pages redirected to login", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
    const response = await updateSession(new NextRequest("https://ownlevel.fit/home"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://ownlevel.fit/login");
  });

  it("redirects an authenticated login request using the verified proxy claims", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "verified-user" } },
      error: null,
    });
    const response = await updateSession(new NextRequest("https://ownlevel.fit/login?error=auth"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://ownlevel.fit/home");
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it("continues protected requests when verified claims are present", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "verified-user" } },
      error: null,
    });
    const response = await updateSession(new NextRequest("https://ownlevel.fit/today"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
