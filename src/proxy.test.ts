import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mocks.updateSession,
}));

import {
  bypassesSessionProxy,
  config,
  proxy,
  requiresSessionProxy,
} from "./proxy";

describe("session proxy routing", () => {
  beforeEach(() => {
    mocks.updateSession.mockReset();
    mocks.updateSession.mockResolvedValue(NextResponse.next());
  });

  it("bypasses Supabase session handling for the ChatGPT integration and preserves Authorization", async () => {
    const authorization = "Bearer ownlevel_test";
    const request = new NextRequest(
      "https://www.ownlevel.fit/api/integrations/chatgpt/meals",
      { headers: { authorization } },
    );

    const response = await proxy(request);

    expect(bypassesSessionProxy(request.nextUrl.pathname)).toBe(true);
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(request.headers.get("authorization")).toBe(authorization);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-authorization")).toBeNull();
  });

  it("keeps protected app pages behind Supabase session handling", async () => {
    const request = new NextRequest("https://www.ownlevel.fit/today");

    await proxy(request);

    expect(bypassesSessionProxy(request.nextUrl.pathname)).toBe(false);
    expect(mocks.updateSession).toHaveBeenCalledOnce();
    expect(mocks.updateSession).toHaveBeenCalledWith(request);
  });

  it.each([
    "/home",
    "/today",
    "/progress",
    "/calendar",
    "/train",
    "/train/exercises",
    "/settings/account",
  ])("keeps %s in the authenticated proxy boundary", (pathname) => {
    expect(requiresSessionProxy(pathname)).toBe(true);
  });

  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icons/icon-192.png",
    "/_next/static/chunk.js",
    "/_next/image",
    "/auth/callback",
    "/api/integrations/chatgpt/status",
  ])("bypasses auth for public resource %s", async (pathname) => {
    const request = new NextRequest(`https://www.ownlevel.fit${pathname}`);

    await proxy(request);

    expect(requiresSessionProxy(pathname)).toBe(false);
    expect(mocks.updateSession).not.toHaveBeenCalled();
  });

  it("uses an allowlist matcher instead of a broad negative asset pattern", () => {
    expect(config.matcher).toEqual([
      "/",
      "/login",
      "/home/:path*",
      "/today/:path*",
      "/history/:path*",
      "/settings/:path*",
      "/train/:path*",
      "/progress/:path*",
      "/calendar/:path*",
    ]);
  });
});
