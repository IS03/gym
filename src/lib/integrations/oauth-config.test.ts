import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ownlevelOAuthAuthorizationScopeAllowed } from "./oauth-config";

describe("OWNLEVEL OAuth authorization scopes", () => {
  it.each([
    "openid",
    "openid email",
    "openid offline_access",
    "openid email offline_access",
    "offline_access openid email",
  ])("accepts the ChatGPT-compatible scope set: %s", (scope) => {
    expect(ownlevelOAuthAuthorizationScopeAllowed(scope)).toBe(true);
  });

  it.each([
    "",
    "email offline_access",
    "openid profile",
    "openid phone",
    "openid meals:write",
    "openid email profile",
  ])("rejects missing openid or additional privileges: %s", (scope) => {
    expect(ownlevelOAuthAuthorizationScopeAllowed(scope)).toBe(false);
  });
});
