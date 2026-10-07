import "server-only";
import { createClient } from "../supabase/server";
import { ownlevelOAuthAdminRpc } from "./oauth-admin";
import { ownlevelIntegrationOrigin, ownlevelOAuthAuthorizationScopeAllowed, ownlevelOAuthConfig, ownlevelOAuthEnabled } from "./oauth-config";

export async function oauthConsentContext(authorizationId: string) {
  if (!ownlevelOAuthEnabled() || !/^[A-Za-z0-9_-]{1,255}$/.test(authorizationId)) return null;
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.auth.getClaims();
  const userId = session?.claims?.sub;
  if (sessionError || !userId || session.claims.client_id || session.claims.is_anonymous) {
    console.info("[oauth-consent] rejected session", {
      hasError: Boolean(sessionError),
      hasUser: Boolean(userId),
      hasClientId: Boolean(session?.claims?.client_id),
      isAnonymous: Boolean(session?.claims?.is_anonymous),
    });
    return null;
  }
  const { data: authorization, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !authorization) {
    console.info("[oauth-consent] authorization lookup failed", {
      hasError: Boolean(error),
      errorCode: (error as { code?: string } | null)?.code ?? null,
      hasAuthorization: Boolean(authorization),
    });
    return null;
  }
  const config = ownlevelOAuthConfig();
  // This binds the server-stored authorization request to the verified user,
  // approved client and exact resource. Never trust hidden form fields for them.
  const { data: clientId, error: policyError } = await ownlevelOAuthAdminRpc<string>(
    "ownlevel_oauth_authorization_client",
    { p_authorization_id: authorizationId, p_user_id: userId, p_resource: config.resource },
  );
  if (policyError || typeof clientId !== "string") {
    console.info("[oauth-consent] policy lookup failed", {
      hasError: Boolean(policyError),
      errorCode: (policyError as { code?: string } | null)?.code ?? null,
      returnedClient: typeof clientId,
    });
    return null;
  }
  if ("client" in authorization) {
    const clientMatches = authorization.client.id === clientId;
    const scopeAllowed = ownlevelOAuthAuthorizationScopeAllowed(authorization.scope);
    if (!clientMatches || !scopeAllowed) {
      console.info("[oauth-consent] authorization details rejected", {
        clientMatches,
        scopeAllowed,
        requestedScope: authorization.scope ?? null,
        detailsClientId: authorization.client.id ?? null,
        policyClientId: clientId,
      });
      return null;
    }
  } else {
    console.info("[oauth-consent] authorization already redirected", {
      hasRedirectUrl: "redirect_url" in authorization,
    });
  }
  return { supabase, authorization, clientId, userId, config };
}

export function sameOriginOAuthDecision(request: Request) {
  const origin = request.headers.get("origin");
  // Browser POSTs must carry an exact same-origin Origin. No fallback to Referer.
  return origin === ownlevelIntegrationOrigin();
}
