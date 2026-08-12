import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { isInvalidAuthSessionError } from "@/lib/supabase/auth-errors";

/** No prerender en `next build` (evita llamar a Supabase sin env, p. ej. en Vercel). */
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: claimsData,
    error,
  } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    if (error && !isInvalidAuthSessionError(error)) {
      throw new Error(`Autenticación: ${error.message}`);
    }
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
