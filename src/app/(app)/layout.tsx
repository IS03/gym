import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getVerifiedRequestContext } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import AppLoading from "./loading";

/** No prerender en `next build` (evita llamar a Supabase sin env, p. ej. en Vercel). */
export const dynamic = "force-dynamic";

async function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");

  return children;
}

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <Suspense fallback={<AppLoading />}>
        <AuthenticatedContent>{children}</AuthenticatedContent>
      </Suspense>
    </AppShell>
  );
}
