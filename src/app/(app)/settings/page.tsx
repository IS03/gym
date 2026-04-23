import { signOut } from "./actions";
import { ThemeSettings } from "./theme-settings";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Perfil, objetivos y preferencias (Fase 1+).
        </p>
      </div>
      <ThemeSettings />
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-full">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
