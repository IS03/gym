/** Exposure boundary only. Route handlers still enforce their own authentication. */
export const OAUTH_PREVIEW_ROUTES: Readonly<Record<string, readonly string[]>> = {
  "/mcp": ["GET", "HEAD", "POST", "DELETE", "OPTIONS"],
  "/mcp/oauth-protected-resource": ["GET", "HEAD", "OPTIONS"],
  "/.well-known/oauth-protected-resource/mcp": ["GET", "HEAD", "OPTIONS"],
  "/oauth/consent": ["GET", "HEAD"],
  "/login": ["GET", "HEAD"],
  "/auth/callback": ["GET", "HEAD"],
  "/api/oauth/decision": ["POST", "OPTIONS"],
  "/api/integrations/chatgpt/meals": ["POST", "OPTIONS"],
};

export const OAUTH_PREVIEW_ASSETS = [
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/brand/logo/isotipo-claro.png",
  "/brand/logo/isotipo-oscuro.png",
] as const;

export function oauthPreviewLockdownEnabled() {
  return process.env.VERCEL === "1"
    && process.env.VERCEL_ENV === "preview"
    && process.env.OWNLEVEL_OAUTH_PREVIEW_LOCKDOWN === "true";
}

export function isOAuthPreviewRequestAllowed(url: URL, method: string) {
  const { pathname } = url;
  // Do not interpret alternate encodings as allowed route/asset boundaries.
  if (/[\\]|%(?:2f|5c|00|2e)/i.test(pathname)) return false;

  const methods = Object.hasOwn(OAUTH_PREVIEW_ROUTES, pathname)
    ? OAUTH_PREVIEW_ROUTES[pathname]
    : undefined;
  if (methods) return methods.includes(method);

  if (method !== "GET" && method !== "HEAD") return false;
  if (OAUTH_PREVIEW_ASSETS.some((asset) => asset === pathname)) return true;
  if (pathname.startsWith("/_next/static/")) return true;

  // Login uses next/image. Never expose a generic optimizer that can fetch
  // arbitrary app/API paths: only these two fixed local logo sources are needed.
  if (pathname === "/_next/image") {
    const sources = url.searchParams.getAll("url");
    return sources.length === 1 && (
      sources[0] === "/brand/logo/isotipo-claro.png"
      || sources[0] === "/brand/logo/isotipo-oscuro.png"
    );
  }
  return false;
}
