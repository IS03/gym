import { Bell, Globe2, KeyRound, Palette } from "lucide-react";
import { listIntegrationApiTokens } from "@/lib/integrations/chatgpt-tokens";
import { SettingsHeader, SettingsRow, SettingsSection } from "../settings-components";
import { ThemeSettings } from "../theme-settings";

export const dynamic = "force-dynamic";

export default async function ApplicationSettingsPage() {
  const tokens = await listIntegrationApiTokens();
  const chatgptConnected = tokens.some((token) => token.revoked_at === null);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <SettingsHeader
        title="Aplicación"
        description="Preferencias de aspecto y conexiones."
        backHref="/settings"
      />

      <section id="theme" className="scroll-mt-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Palette className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold">Tema</h2>
            <p className="text-sm text-muted-foreground">Elegí el aspecto de la aplicación.</p>
          </div>
        </div>
        <div className="mt-4">
          <ThemeSettings />
        </div>
      </section>

      <div id="integrations" className="scroll-mt-4">
        <SettingsSection title="Integraciones">
          <SettingsRow
            href="/settings/nutrition/integrations"
            icon={KeyRound}
            title="ChatGPT"
            description="Registrá comidas desde tu GPT privado"
            trailing={
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className={chatgptConnected ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-muted-foreground/45"} aria-hidden />
                {chatgptConnected ? "Conectado" : "Sin conectar"}
              </span>
            }
          />
        </SettingsSection>
      </div>

      <SettingsSection title="Personalización">
        <SettingsRow
          icon={Globe2}
          title="Idioma"
          description="Español · Inglés próximamente"
          trailing={<span className="text-xs font-medium text-primary">Español</span>}
        />
        <SettingsRow
          icon={Bell}
          title="Notificaciones"
          description="Disponible próximamente"
          trailing={<span className="text-xs font-medium text-muted-foreground">Próximamente</span>}
          disabled
        />
      </SettingsSection>
    </div>
  );
}
