const EXPECTED_PROTOCOL = "ownlevel:";
const EXPECTED_HOST = "auth";
const EXPECTED_PATH = "/callback";

export type NativeAuthCallback =
  | { kind: "code"; code: string }
  | { kind: "oauth_error"; reason: "cancelled" | "provider_error" }
  | { kind: "invalid" };

export function parseNativeAuthCallback(
  rawUrl: string,
): NativeAuthCallback | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== EXPECTED_PROTOCOL ||
    url.hostname !== EXPECTED_HOST ||
    url.pathname !== EXPECTED_PATH
  ) {
    return null;
  }

  if (url.username || url.password || url.port || url.hash) {
    return { kind: "invalid" };
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return {
      kind: "oauth_error",
      reason: oauthError === "access_denied" ? "cancelled" : "provider_error",
    };
  }

  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return { kind: "invalid" };
  }

  return { kind: "code", code };
}

export class OAuthCallbackGate {
  private readonly claimed = new Set<string>();

  claim(code: string): boolean {
    if (this.claimed.has(code)) {
      return false;
    }

    this.claimed.add(code);
    return true;
  }
}
