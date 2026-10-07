import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeAuthRedirectPath } from "@/lib/security/auth-redirect";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthRedirectPath(searchParams.get("next"));
  const failedLogin = () => {
    const destination = new URL("/login", origin);
    destination.searchParams.set("error", "auth");
    if (next !== "/home") destination.searchParams.set("next", next);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  if (!url || !anonKey || !code) {
    return failedLogin();
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // ignore
        }
      },
    },
  });

  let error: unknown;
  try {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } catch {
    return failedLogin();
  }

  if (error) {
    return failedLogin();
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
