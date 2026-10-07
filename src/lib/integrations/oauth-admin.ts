import "server-only";
import { ownlevelOAuthConfig } from "./oauth-config";

const ALLOWED_RPC = new Set([
  "ownlevel_oauth_authorization_client",
  "ownlevel_oauth_grant_meals",
  "ownlevel_oauth_revoke_meals",
]);

export async function ownlevelOAuthAdminRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  if (!ALLOWED_RPC.has(functionName)) {
    return { data: null, error: { message: "OAuth admin RPC not allowed" } };
  }
  let config: ReturnType<typeof ownlevelOAuthConfig>;
  try { config = ownlevelOAuthConfig(); } catch {
    return { data: null, error: { message: "OAuth configuration unavailable", code: "OAUTH_CONFIGURATION_INVALID" } };
  }
  try {
    const response = await fetch(
      `${config.env.url}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: {
          apikey: config.env.secretKeys.default,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      const message = `OAuth admin RPC failed (${response.status})`;
      let code: string | undefined;
      try {
        const payload = await response.json() as { code?: string };
        if (typeof payload.code === "string" && /^[A-Z0-9_]{1,40}$/.test(payload.code)) code = payload.code;
      } catch {}
      return { data: null, error: { message, code } };
    }
    if (response.status === 204) return { data: null, error: null };
    return { data: await response.json() as T, error: null };
  } catch {
    // Never log thrown messages/stack, request body, Headers or response body:
    // upstream failures may include credentials or private authorization data.
    console.error("[oauth-admin] transport unavailable", {
      rpc: functionName,
    });
    return { data: null, error: { message: "OAuth service temporarily unavailable", code: "OAUTH_ADMIN_UNAVAILABLE" } };
  }
}
