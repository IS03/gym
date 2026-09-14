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

  it.each(["/progress", "/calendar"]) (
    "redirects unauthenticated requests to the protected route %s",
    async (pathname) => {
      mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });

      const response = await updateSession(
        new NextRequest(`https://ownlevel.fit${pathname}`),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://ownlevel.fit/login");
    },
  );

  it("redirects and clears auth cookies only for a genuinely invalid session", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: null },
      error: { code: "refresh_token_not_found", message: "Refresh token not found" },
    });
    const request = new NextRequest("https://ownlevel.fit/home", {
      headers: { cookie: "sb-project-auth-token=invalid; preference=compact" },
    });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("");
    expect(mocks.getClaims).toHaveBeenCalledOnce();
  });

  it.each([
    { message: "Gateway Timeout", status: 504 },
    { message: "fetch failed: network unavailable", code: "ECONNRESET" },
  ])("never clears cookies or simulates logout for transient auth errors", async (error) => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.getClaims.mockResolvedValue({ data: { claims: null }, error });
    const request = new NextRequest("https://ownlevel.fit/home", {
      headers: { cookie: "sb-project-auth-token=still-valid" },
    });

    await expect(updateSession(request)).rejects.toEqual(error);
    expect(request.cookies.get("sb-project-auth-token")?.value).toBe("still-valid");
    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("[perf]", expect.objectContaining({
      status: "error",
    }));
    log.mockRestore();
  });
});
