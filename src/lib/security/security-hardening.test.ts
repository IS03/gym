import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeAuthRedirectPath } from "./auth-redirect";
import { SECURITY_HEADERS } from "./headers";
import {
  readJsonRequestBody,
  RequestBodyTooLargeError,
} from "./request-body";

describe("security hardening", () => {
  it("permite sólo redirects internos absolutos", () => {
    expect(safeAuthRedirectPath("/today?date=2026-08-27")).toBe(
      "/today?date=2026-08-27",
    );
    for (const unsafe of [
      null,
      "",
      "today",
      "https://example.com",
      "//example.com/path",
      "/\\example.com",
      "/home\nSet-Cookie:x",
    ]) {
      expect(safeAuthRedirectPath(unsafe)).toBe("/home");
    }
  });

  it("define headers conservadores contra MIME sniffing, framing y referrer leakage", () => {
    expect(Object.fromEntries(SECURITY_HEADERS.map(({ key, value }) => [key, value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("lee JSON por bytes sin depender de Content-Length", async () => {
    const request = new Request("https://www.ownlevel.fit/api/test", {
      method: "POST",
      body: JSON.stringify({ description: "técnica" }),
    });
    const result = await readJsonRequestBody(request, 128);
    expect(result.body).toEqual({ description: "técnica" });
    expect(result.byteLength).toBe(
      new TextEncoder().encode(JSON.stringify({ description: "técnica" })).byteLength,
    );
  });

  it("interrumpe un body real que supera el límite", async () => {
    const request = new Request("https://www.ownlevel.fit/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "á".repeat(100) }),
    });
    await expect(readJsonRequestBody(request, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("no permite que el service worker persista páginas, RSC ni APIs privadas", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("cacheOnFrontEndNav: false");
    for (const cacheName of ["apis", "pages-rsc-prefetch", "pages-rsc", "pages"]) {
      expect(config).toContain(`cacheName: \"${cacheName}\"`);
    }
    expect(config.match(/handler: \"NetworkOnly\"/g)).toHaveLength(4);
  });

  it("mantiene la credencial administrativa server-only y nunca NEXT_PUBLIC", () => {
    const admin = readFileSync("src/lib/supabase/admin.ts", "utf8");
    expect(admin).toContain('import "server-only"');
    expect(admin).toContain("SUPABASE_SECRET_KEY");
    expect(admin).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(admin).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
    expect(admin).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE");
  });
});
