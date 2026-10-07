import "server-only";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { ownlevelIntegrationOrigin, ownlevelOAuthAuthorizationScopeAllowed, ownlevelOAuthConfig, ownlevelOAuthEnabled } from "./oauth-config";

export async function oauthConsentContext(authorizationId: string) {
  if (!ownlevelOAuthEnabled() || !/^[A-Za-z0-9_-]{1,255}$/.test(authorizationId)) return null;
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.auth.getClaims();
  const userId = session?.claims?.sub;
  if (sessionError || !userId || session.claims.client_id || session.claims.is_anonymous) return null;
  const { data: authorization, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !authorization) return null;
  const config = ownlevelOAuthConfig();
  const admin = createAdminClient();
  // This binds the server-stored authorization request to the verified user,
  // approved client and exact resource. Never trust hidden form fields for them.
  const { data: clientId, error: policyError } = await admin.rpc("ownlevel_oauth_authorization_client", {
    p_authorization_id: authorizationId, p_user_id: userId, p_resource: config.resource,
  });
  if (policyError || typeof clientId !== "string") return null;
  if ("client" in authorization && (authorization.client.id !== clientId || !ownlevelOAuthAuthorizationScopeAllowed(authorization.scope))) return null;
  return { supabase, admin, authorization, clientId, userId, config };
}

export function sameOriginOAuthDecision(request: Request) {
  const origin = request.headers.get("origin");
  // Browser POSTs must carry an exact same-origin Origin. No fallback to Referer.
  return origin === ownlevelIntegrationOrigin();
}
