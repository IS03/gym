import { redirect } from "next/navigation";
import { getVerifiedRequestContext } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

/** No prerender en `next build` (evita llamar a Supabase sin env, p. ej. en Vercel). */
export const dynamic = "force-dynamic";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
