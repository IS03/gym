import Link from "next/link";
import { BookOpen, ChartNoAxesColumnIncreasing, ChevronRight, KeyRound, Palette, ShieldCheck, Utensils } from "lucide-react";
import { getAuthedUser, getProfileForUser } from "@/lib/phase1/profile";
import { ProfileInitial, SettingsHeader, SettingsRow, SettingsSection } from "./settings-components";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthedUser();
  const profile = await getProfileForUser(user.id);
  const displayName = profile?.display_name?.trim() || "Tu perfil";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <SettingsHeader
        title="Ajustes"
        description="Tu cuenta, tu plan y tus preferencias de OWNLEVEL."
      />

      <Link
        href="/settings/profile"
        className="flex min-h-28 items-center gap-3 rounded-2xl bg-card px-4 py-4 shadow-sm ring-1 ring-foreground/8 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProfileInitial name={displayName} className="size-16" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{displayName}</span>
          <span className="block truncate text-sm text-muted-foreground">{user.email ?? "—"}</span>
          <span className="mt-1 block text-xs text-muted-foreground">Perfil y datos físicos</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <SettingsSection title="Tu plan">
        <SettingsRow
          href="/settings/nutrition"
          icon={Utensils}
          title="Plan nutricional"
          description="Objetivos, calorías, cálculo y ajustes"
        />
        <SettingsRow
          href="/settings/library"
          icon={BookOpen}
          title="Biblioteca"
          description="Alimentos y comidas guardadas"
        />
        <SettingsRow
          icon={ChartNoAxesColumnIncreasing}
          title="Métricas diarias"
          description="Configurá qué querés registrar cada día"
          trailing={<span className="text-xs font-medium text-muted-foreground">Próximamente</span>}
          disabled
        />
      </SettingsSection>

      <SettingsSection title="Preferencias">
        <SettingsRow
          href="/settings/application#theme"
          icon={Palette}
          title="Apariencia"
          description="Tema del sistema"
        />
        <SettingsRow
          href="/settings/application#integrations"
          icon={KeyRound}
          title="Integraciones"
          description="ChatGPT"
        />
      </SettingsSection>

      <SettingsSection title="Cuenta">
        <SettingsRow
          href="/settings/account"
          icon={ShieldCheck}
          title="Cuenta y seguridad"
          description="Cuenta conectada"
        />
      </SettingsSection>
    </div>
  );
}
