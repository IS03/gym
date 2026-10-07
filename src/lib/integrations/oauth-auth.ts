import "server-only";
import {
  resourceMetadataResponse, withOAuthProtectedResource, withSupabase,
  type JWTClaims, type SupabaseContext, type WithSupabaseConfig,
} from "@supabase/server";
import { OWNLEVEL_MEAL_PERMISSION, OWNLEVEL_OAUTH_SCOPES, ownlevelOAuthConfig, ownlevelOAuthEnabled } from "./oauth-config";
export { IntegrationPermissionDeniedError as OAuthPermissionDeniedError } from "./chatgpt-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type OAuthMealIdentity = {
  userId: string; clientId: string; sessionId: string; grantId: string; resource: string;
};

// Input MUST already be verified by @supabase/server. No decoding-only identity.
export function mealIdentityFromVerifiedClaims(claims: JWTClaims | null, resource: string): OAuthMealIdentity | null {
  if (!claims || typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000
    || claims.role !== "authenticated" || claims.is_anonymous !== false
    || !Array.isArray(claims.ownlevel_permissions)
    || !claims.ownlevel_permissions.includes(OWNLEVEL_MEAL_PERMISSION)) return null;
  const values = [claims.sub, claims.client_id, claims.session_id, claims.ownlevel_grant_id];
  if (!values.every((v) => typeof v === "string" && UUID.test(v))) return null;
  return { userId: claims.sub, clientId: claims.client_id as string,
    sessionId: claims.session_id as string, grantId: claims.ownlevel_grant_id as string, resource };
}

export function oauthIdentityParameters(identity: OAuthMealIdentity) {
  return { p_user_id: identity.userId, p_client_id: identity.clientId,
    p_session_id: identity.sessionId, p_grant_id: identity.grantId, p_resource: identity.resource };
}

export function oauthDenied(config: { metadataUrl: string }, status: 401 | 403 = 403) {
  return Response.json({ ok: false, error: status === 401 ? "invalid_token" : "permission_denied",
    message: "La conexión no tiene permiso vigente para registrar comidas." }, {
    status, headers: { "Cache-Control": "no-store", "WWW-Authenticate":
      `Bearer resource_metadata="${config.metadataUrl}", error="${status === 401 ? "invalid_token" : "insufficient_scope"}"` },
  });
}

// Exported factory allows cryptographic tests with synthetic keys, without
// replacing standard JWT validation or needing a production credential.
export function createOAuthMealGate(
  config: WithSupabaseConfig & { resource: string; metadataUrl: string },
  handler: (req: Request, identity: OAuthMealIdentity, ctx: SupabaseContext) => Promise<Response>,
) {
  return withSupabase({ ...config, auth: "user", audience: config.resource, cors: false, errors: { detailed: false } }, async (req, ctx) => {
    const identity = mealIdentityFromVerifiedClaims(ctx.jwtClaims, config.resource);
    if (!identity) return oauthDenied(config);
    const { data, error } = await ctx.supabaseAdmin.rpc("ownlevel_oauth_access_allowed", oauthIdentityParameters(identity));
    if (error) return Response.json({ ok: false, error: "internal_error" }, { status: 503 });
    if (data !== true) return oauthDenied(config);
    return handler(req, identity, ctx);
  });
}

export async function withOwnlevelOAuth(
  req: Request, handler: (req: Request, identity: OAuthMealIdentity, ctx: SupabaseContext) => Promise<Response>,
) {
  if (!ownlevelOAuthEnabled()) return Response.json({ error: "integration_disabled" }, { status: 503 });
  let config: ReturnType<typeof ownlevelOAuthConfig>;
  try { config = ownlevelOAuthConfig(); } catch {
    return Response.json({ error: "integration_unavailable" }, { status: 503 });
  }
  const gate = createOAuthMealGate({ ...config, issuer: config.issuer }, handler);
  const response = await withOAuthProtectedResource({ resourceServer: config.resource, authorizationServer: config.issuer }, gate)(req);
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 401) {
    response.headers.set("WWW-Authenticate", `Bearer resource_metadata="${config.metadataUrl}", error="invalid_token"`);
  }
  return response;
}

export async function ownlevelMetadata(req: Request) {
  if (!ownlevelOAuthEnabled()) return Response.json({ error: "integration_disabled" }, { status: 503 });
  try {
    const config = ownlevelOAuthConfig();
    const response = resourceMetadataResponse(req, { resource: config.resource, authorizationServers: [config.issuer] });
    const body = await response.json();
    return Response.json({ ...body, scopes_supported: OWNLEVEL_OAUTH_SCOPES }, { headers: response.headers });
  } catch { return Response.json({ error: "integration_unavailable" }, { status: 503 }); }
}
