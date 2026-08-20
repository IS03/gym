import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function bypassesSessionProxy(pathname: string) {
  return pathname === "/api/integrations/chatgpt"
    || pathname.startsWith("/api/integrations/chatgpt/");
}

export async function proxy(request: NextRequest) {
  if (bypassesSessionProxy(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Excluir estáticos y assets; el resto pasa por refresh de sesión.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
