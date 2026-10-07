import { fromSupabaseUrl } from "@supabase/server";

export const OWNLEVEL_MCP_RESOURCE = "https://www.ownlevel.fit/mcp";
export const OWNLEVEL_MEAL_PERMISSION = "meals:write";
export const OWNLEVEL_OAUTH_SCOPES = ["openid"];

export function ownlevelOAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resource = process.env.OWNLEVEL_MCP_RESOURCE ?? OWNLEVEL_MCP_RESOURCE;
  if (!url || !publishable || !secret) throw new Error("OAuth configuration unavailable");
  const resourceUrl = new URL(resource);
  if (resourceUrl.protocol !== "https:" || resourceUrl.pathname !== "/mcp"
    || resourceUrl.search || resourceUrl.hash || resourceUrl.username || resourceUrl.password) {
    throw new Error("Invalid MCP resource");
  }
  return {
    resource,
    issuer: fromSupabaseUrl(url),
    metadataUrl: `${resourceUrl.origin}/.well-known/oauth-protected-resource/mcp`,
    env: { url, publishableKeys: { default: publishable }, secretKeys: { default: secret } },
  };
}

export function ownlevelOAuthEnabled() {
  return process.env.OWNLEVEL_OAUTH_ENABLED === "true";
}

export function ownlevelIntegrationOrigin() {
  const origin = new URL(ownlevelOAuthConfig().resource).origin;
  const localOrigin = process.env.OWNLEVEL_LOCAL_API_ORIGIN;
  if (!localOrigin) return origin;
  const local = new URL(localOrigin);
  if (process.env.NODE_ENV === "production" || local.protocol !== "http:"
    || !["127.0.0.1", "localhost"].includes(local.hostname)
    || local.pathname !== "/" || local.search || local.hash || local.username || local.password) {
    throw new Error("Invalid local integration origin");
  }
  return local.origin;
}
