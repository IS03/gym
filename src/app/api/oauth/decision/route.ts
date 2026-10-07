import { NextResponse } from "next/server";
import { oauthConsentContext, sameOriginOAuthDecision } from "@/lib/integrations/oauth-consent";
import { ownlevelOAuthEnabled } from "@/lib/integrations/oauth-config";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!ownlevelOAuthEnabled()) return new Response("Integration disabled", { status: 503 });
  if (!sameOriginOAuthDecision(request)) return new Response("Forbidden", { status: 403 });
  if (Number(request.headers.get("content-length")) > 4096) return new Response(null, { status: 413 });
  // Read through a bounded stream; do not trust Content-Length alone.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  let raw = ""; let bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return new Response(null, { status: 413 }); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally { reader.releaseLock(); }
  const form = new URLSearchParams(raw);
  if ([...form.keys()].some((key) => !["authorization_id", "decision"].includes(key))
    || form.getAll("authorization_id").length !== 1 || form.getAll("decision").length !== 1) {
    return new Response(null, { status: 400 });
  }
  const id = form.get("authorization_id") ?? "";
  const decision = form.get("decision");
  if (decision !== "approve" && decision !== "deny") return new Response(null, { status: 400 });
  const context = await oauthConsentContext(id);
  if (!context) return new Response("Authorization unavailable", { status: 403 });
  const { supabase, admin, authorization, userId, clientId, config } = context;
  if (decision === "approve") {
    const { error } = await admin.rpc("ownlevel_oauth_grant_meals", {
      p_user_id: userId, p_client_id: clientId, p_resource: config.resource, p_authorization_id: id,
    });
    if (error) return new Response("Authorization unavailable", { status: 503 });
  }
  // Supabase owns codes, redirects, token exchange and PKCE validation.
  const result = "redirect_url" in authorization && decision === "approve"
    ? { data: authorization, error: null }
    : decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (result.error || !result.data?.redirect_url) {
    if (decision === "approve") {
      await admin.rpc("ownlevel_oauth_revoke_meals", { p_user_id: userId, p_client_id: clientId });
    }
    return NextResponse.redirect(new URL(`/oauth/consent?authorization_id=${encodeURIComponent(id)}&error=decision`, request.url), 303);
  }
  const response = NextResponse.redirect(result.data.redirect_url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
