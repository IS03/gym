import { signOut } from "./actions";
import { ThemeSettings } from "./theme-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthedUser, getProfileForUser } from "@/lib/phase1/profile";
import { ProfileForm } from "./profile-form";
import { Mail, Palette, ShieldCheck, UserRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthedUser();
  const profile = await getProfileForUser(user.id);
  const displayName = profile?.display_name?.trim() || "Tu perfil";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta, información personal y preferencias de Appgym.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="settings-profile">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" aria-hidden />
          <h2 id="settings-profile" className="text-base font-semibold tracking-tight">
            Perfil
          </h2>
        </div>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="settings-personal-data">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" aria-hidden />
          <h2 id="settings-personal-data" className="text-base font-semibold tracking-tight">
            Datos personales
          </h2>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Información y referencia física</CardTitle>
            <p className="text-sm text-muted-foreground">
              Se usa para personalizar el seguimiento nutricional.
            </p>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="settings-app-data">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-primary" aria-hidden />
          <h2 id="settings-app-data" className="text-base font-semibold tracking-tight">
            Datos de la app
          </h2>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Apariencia</CardTitle>
            <p className="text-sm text-muted-foreground">
              Esta preferencia queda guardada en este dispositivo.
            </p>
          </CardHeader>
          <CardContent>
            <ThemeSettings />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="settings-security">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          <h2 id="settings-security" className="text-base font-semibold tracking-tight">
            Cuenta y seguridad
          </h2>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">Cuenta conectada</p>
                <p className="truncate text-sm text-muted-foreground">{user.email ?? "—"}</p>
              </div>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="h-11 w-full">
                Cerrar sesión en este dispositivo
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
