import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), context: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims } }) }));
vi.mock("@/lib/integrations/oauth-consent", () => ({ oauthConsentContext: mocks.context }));
vi.mock("@/lib/integrations/oauth-config", () => ({ ownlevelOAuthEnabled: () => process.env.OWNLEVEL_OAUTH_ENABLED === "true" }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import Page from "./page";
import ConsentError from "./error";

const id = "synthetic_pending_request";
beforeEach(() => {
  vi.stubEnv("OWNLEVEL_OAUTH_ENABLED", "true");
  mocks.claims.mockReset().mockResolvedValue({ data: { claims: { sub: "synthetic-user" } } });
  mocks.context.mockReset().mockResolvedValue({ clientId: "synthetic-client" });
  mocks.redirect.mockReset().mockImplementation((url) => { throw new Error(`REDIRECT:${url}`); });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("OAuth consent URL-driven rendering", () => {
  it("preserves authorization_id in next when a user needs login", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: null } });
    await expect(Page({ searchParams: Promise.resolve({ authorization_id: id }) })).rejects.toThrow("REDIRECT:");
    const destination = new URL(mocks.redirect.mock.calls[0][0], "https://preview.example");
    const next = new URL(destination.searchParams.get("next")!, destination.origin);
    expect(destination.pathname).toBe("/login");
    expect(next.pathname).toBe("/oauth/consent");
    expect(next.searchParams.get("authorization_id")).toBe(id);
  });

  it("renders the same pending authorization after a fresh server render/reload without ephemeral state", async () => {
    for (let reload = 0; reload < 2; reload++) {
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ authorization_id: id }) }));
      expect(html).toContain("Conectar OWNLEVEL Meals");
      expect(html).toContain("Autorizar registro de comidas");
      expect(html).toContain(`name="authorization_id" value="${id}"`);
      expect(mocks.context).toHaveBeenLastCalledWith(id);
    }
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps a failed decision tied to the same pending URL/form", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ authorization_id: id, error: "decision" }) }));
    expect(html).toContain(`name="authorization_id" value="${id}"`);
    expect(html).toContain("No pudimos completar la autorización");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("renders a controlled retry component on configuration/network failure, without leaking it or redirecting", async () => {
    mocks.context.mockRejectedValue(new Error("synthetic-private-credential"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await Page({ searchParams: Promise.resolve({ authorization_id: id }) }) as ReactElement;
    expect(result.type).toBe(ConsentError);
    expect(JSON.stringify(log.mock.calls)).not.toContain("synthetic-private-credential");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
