import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  isOAuthPreviewRequestAllowed,
  oauthPreviewLockdownEnabled,
} from "@/lib/security/oauth-preview-lockdown";

export const SESSION_PROXY_PATH_PREFIXES = [
  "/home",
  "/today",
  "/history",
  "/settings",
  "/train",
  "/progress",
  "/calendar",
  "/oauth/consent",
] as const;

export function requiresSessionProxy(pathname: string) {
  if (pathname === "/" || pathname === "/login") return true;
  return SESSION_PROXY_PATH_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function bypassesSessionProxy(pathname: string) {
  return pathname === "/api/integrations/chatgpt"
    || pathname.startsWith("/api/integrations/chatgpt/");
}

export async function proxy(request: NextRequest) {
  if (
    oauthPreviewLockdownEnabled()
    && !isOAuthPreviewRequestAllowed(request.nextUrl, request.method)
  ) {
    // Deny before session refresh, redirects, render or API execution. Do not
    // redirect into the product or cache a response across environments.
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-OWNLEVEL-Preview-Lockdown": "blocked",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  if (
    !requiresSessionProxy(request.nextUrl.pathname)
    || bypassesSessionProxy(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  // Must cover APIs and public files too: exclusions would bypass lockdown.
  // Outside the opt-in preview, requiresSessionProxy preserves existing routing.
  matcher: ["/:path*"],
};
