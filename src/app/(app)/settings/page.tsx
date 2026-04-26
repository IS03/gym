import { signOut } from "./actions";
import { ThemeSettings } from "./theme-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthedUser, getMyProfile } from "@/lib/phase1/profile";
import { saveProfileAction } from "./profile-actions";

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
          <p className="text-xs text-muted-foreground">{user.email ?? "—"}</p>
        </CardHeader>
        <CardContent>
          <form action={saveProfileAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="display_name">Nombre</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
                placeholder="Opcional"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="birth_date">Nacimiento</Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  defaultValue={profile?.birth_date ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sex">Género</Label>
                <select
                  id="sex"
                  name="sex"
                  defaultValue={profile?.sex ?? ""}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="height_cm">Altura (cm)</Label>
                <Input
                  id="height_cm"
                  name="height_cm"
                  inputMode="numeric"
                  defaultValue={profile?.height_cm ?? ""}
                  placeholder="Ej: 178"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="current_weight_kg">Peso (kg)</Label>
                <Input
                  id="current_weight_kg"
                  name="current_weight_kg"
                  inputMode="decimal"
                  defaultValue={profile?.current_weight_kg ?? ""}
                  placeholder="Ej: 82.4"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="activity_level">Nivel de actividad</Label>
              <select
                id="activity_level"
                name="activity_level"
                defaultValue={profile?.activity_level ?? ""}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                <option value="sedentary">Sedentario</option>
                <option value="light">Ligero</option>
                <option value="moderate">Moderado</option>
                <option value="active">Activo</option>
                <option value="very_active">Muy activo</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="goal_type">Objetivo</Label>
              <select
                id="goal_type"
                name="goal_type"
                defaultValue={profile?.goal_type ?? ""}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                <option value="lose">Bajar</option>
                <option value="maintain">Mantener</option>
                <option value="gain">Subir</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Target = mantenimiento ± 300 kcal (simple en Fase 1).
              </p>
            </div>

            <div className="rounded-md border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Calculado</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">BMR</p>
                  <p className="text-sm font-medium">
                    {profile?.bmr_kcal_current ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mant.</p>
                  <p className="text-sm font-medium">
                    {profile?.maintenance_kcal_current ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-sm font-medium">
                    {profile?.target_kcal_current ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <Button className="h-11 w-full" type="submit">
              Guardar perfil
            </Button>
          </form>
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
