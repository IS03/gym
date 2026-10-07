import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { oauthConsentContext } from "@/lib/integrations/oauth-consent";
import { ownlevelOAuthEnabled } from "@/lib/integrations/oauth-config";

export const dynamic = "force-dynamic";

export default async function OAuthConsentPage({ searchParams }: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>
}) {
  const { authorization_id: id, error } = await searchParams;
  if (!ownlevelOAuthEnabled() || !id || !/^[A-Za-z0-9_-]{1,255}$/.test(id)) {
    return <p role="alert">La solicitud de conexión no está disponible.</p>;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub || data.claims.client_id || data.claims.is_anonymous) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(id)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const context = await oauthConsentContext(id);
  if (!context) return <p role="alert">La solicitud venció o el cliente no está autorizado. Volvé a conectar desde ChatGPT.</p>;
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 py-8">
    <p className="text-sm font-semibold tracking-widest">OWNLEVEL</p>
    <section className="space-y-4 rounded-[20px] border bg-card p-[18px]">
      <h1 className="text-2xl font-semibold">Conectar OWNLEVEL Meals</h1>
      <p className="text-sm text-muted-foreground">ChatGPT podrá registrar comidas en tu cuenta de OWNLEVEL. No podrá acceder directamente a tus tablas ni modificar entrenamientos.</p>
      <p className="text-sm">Permiso de OWNLEVEL: registrar comidas.</p>
      <p className="text-sm text-muted-foreground">OAuth usa <code>openid</code> para identificarte. Podés revocar el acceso en Ajustes → Integraciones.</p>
      {error ? <p role="alert" className="text-sm text-destructive">No pudimos completar la autorización. Intentá nuevamente.</p> : null}
      <form method="post" action="/api/oauth/decision" className="flex flex-col gap-3">
        <input type="hidden" name="authorization_id" value={id} />
        <Button type="submit" name="decision" value="approve" className="h-[50px] rounded-[14px]">Autorizar registro de comidas</Button>
        <Button type="submit" name="decision" value="deny" variant="outline" className="h-[50px] rounded-[14px]">No autorizar</Button>
      </form>
    </section>
  </main>;
}
