import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOriginOAuthDecision } from "@/lib/integrations/oauth-consent";
import { ownlevelOAuthEnabled } from "@/lib/integrations/oauth-config";
import { readJsonRequestBody } from "@/lib/security/request-body";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!ownlevelOAuthEnabled()) return new Response(null, { status: 503 });
  if (!sameOriginOAuthDecision(request)) return new Response(null, { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId || data.claims.client_id || data.claims.is_anonymous) return new Response(null, { status: 401 });
  let body: unknown;
  try { ({ body } = await readJsonRequestBody(request, 1024)); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1
    || !("client_id" in body) || typeof body.client_id !== "string"
    || !/^[0-9a-f-]{36}$/i.test(body.client_id)) return new Response(null, { status: 400 });
  // Revoke the authoritative local grant first. Even if Supabase is temporarily
  // unavailable, previously issued JWTs immediately lose write permission.
  const { error: revoked } = await createAdminClient().rpc("ownlevel_oauth_revoke_meals", { p_user_id: userId, p_client_id: body.client_id });
  if (revoked) return new Response(null, { status: 503 });
  const { error: remoteError } = await supabase.auth.oauth.revokeGrant({ clientId: body.client_id });
  return Response.json({ ok: true, oauth_cleanup_pending: Boolean(remoteError) }, { headers: { "Cache-Control": "no-store" } });
}
