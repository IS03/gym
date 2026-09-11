import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const SESSION_PROXY_PATH_PREFIXES = [
  "/home",
  "/today",
  "/history",
  "/settings",
  "/train",
  "/progress",
  "/calendar",
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
    !requiresSessionProxy(request.nextUrl.pathname)
    || bypassesSessionProxy(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/home/:path*",
    "/today/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/train/:path*",
    "/progress/:path*",
    "/calendar/:path*",
  ],
};
