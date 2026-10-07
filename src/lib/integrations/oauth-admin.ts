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
  const config = ownlevelOAuthConfig();
  const secret = config.env.secretKeys.default;
  const response = await fetch(
    `${config.env.url}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: secret,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) {
    let message = `OAuth admin RPC failed (${response.status})`;
    let code: string | undefined;
    try {
      const payload = await response.json() as { message?: string; code?: string };
      if (payload.message) message = payload.message;
      code = payload.code;
    } catch {}
    return { data: null, error: { message, code } };
  }
  if (response.status === 204) return { data: null, error: null };
  return { data: await response.json() as T, error: null };
}
