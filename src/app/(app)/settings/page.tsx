import { signOut } from "./actions";
import { ThemeSettings } from "./theme-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthedUser, getMyProfile } from "@/lib/phase1/profile";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthedUser();
  const profile = await getMyProfile();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Perfil, objetivos y preferencias (Fase 1+).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm email={user.email ?? null} profile={profile} />
        </CardContent>
      </Card>

      <ThemeSettings />
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
