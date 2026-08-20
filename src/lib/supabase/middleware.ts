import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isInvalidAuthSessionError } from "./auth-errors";

function isProtectedPath(pathname: string) {
  return ["/home", "/today", "/history", "/settings", "/train"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function copyAuthResponse(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")) {
      request.cookies.delete(cookie.name);
      response.cookies.set({
        name: cookie.name,
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
  }
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // Debe ser la primera operación luego de crear el cliente: refresca una
  // sesión válida y copia las cookies resultantes al request y a la response.
  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError && !isInvalidAuthSessionError(claimsError)) {
    throw claimsError;
  }

  if (!claimsData?.claims?.sub && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const redirectResponse = NextResponse.redirect(loginUrl);
    copyAuthResponse(supabaseResponse, redirectResponse);
    if (claimsError && isInvalidAuthSessionError(claimsError)) {
      clearAuthCookies(request, redirectResponse);
    }
    return redirectResponse;
  }

  if (claimsData?.claims?.sub && request.nextUrl.pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/home";
    homeUrl.search = "";
    const redirectResponse = NextResponse.redirect(homeUrl);
    copyAuthResponse(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  if (claimsError && isInvalidAuthSessionError(claimsError)) {
    clearAuthCookies(request, supabaseResponse);
  }

  return supabaseResponse;
}
