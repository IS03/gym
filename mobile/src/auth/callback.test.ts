import { describe, expect, it } from "vitest";

import { OAuthCallbackGate, parseNativeAuthCallback } from "./callback";

describe("native auth callback", () => {
  it("accepts only the configured callback and extracts the PKCE code", () => {
    expect(
      parseNativeAuthCallback("ownlevel://auth/callback?code=pkce-code"),
    ).toEqual({ kind: "code", code: "pkce-code" });

    expect(
      parseNativeAuthCallback("other://auth/callback?code=pkce-code"),
    ).toBeNull();
    expect(
      parseNativeAuthCallback("ownlevel://other/callback?code=pkce-code"),
    ).toBeNull();
    expect(
      parseNativeAuthCallback("ownlevel://auth/other?code=pkce-code"),
    ).toBeNull();
    expect(parseNativeAuthCallback("ownlevel://app/train")).toBeNull();
  });

  it("rejects malformed expected callbacks without retaining sensitive fields", () => {
    expect(parseNativeAuthCallback("ownlevel://auth/callback")).toEqual({
      kind: "invalid",
    });
    expect(
      parseNativeAuthCallback("ownlevel://auth/callback?code=value#fragment"),
    ).toEqual({ kind: "invalid" });
    expect(parseNativeAuthCallback("not a url")).toBeNull();
  });

  it("classifies an OAuth cancellation without exposing its description", () => {
    expect(
      parseNativeAuthCallback(
        "ownlevel://auth/callback?error=access_denied&error_description=private",
      ),
    ).toEqual({ kind: "oauth_error", reason: "cancelled" });
  });

  it("claims a callback code only once", () => {
    const gate = new OAuthCallbackGate();

    expect(gate.claim("same-code")).toBe(true);
    expect(gate.claim("same-code")).toBe(false);
    expect(gate.claim("different-code")).toBe(true);
  });
});
