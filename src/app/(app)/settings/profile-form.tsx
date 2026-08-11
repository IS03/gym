import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/phase1/profile";
import { saveProfileAction } from "./profile-actions";

type ProfileFormProps = {
  profile: Profile | null;
};

export function ProfileForm({ profile }: ProfileFormProps) {
  return (
    <form action={saveProfileAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="display_name">Cómo querés que te llamemos</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={profile?.display_name ?? ""}
          placeholder="Ej: Nacho"
        />
      </div>

      <div className="grid gap-3 min-[430px]:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="birth_date">Nacimiento</Label>
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={profile?.birth_date ?? ""}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="sex">Género</Label>
          <select
            id="sex"
            name="sex"
            defaultValue={profile?.sex ?? ""}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 pr-8 text-base transition-[color,border-color,box-shadow] duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm"
          >
            <option value="">—</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 min-[430px]:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="height_cm">Altura (cm)</Label>
          <Input
            id="height_cm"
            name="height_cm"
            inputMode="numeric"
            defaultValue={
              profile?.height_cm == null ? "" : String(profile.height_cm)
            }
            placeholder="Ej: 178"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="current_weight_kg">Peso (kg)</Label>
          <Input
            id="current_weight_kg"
            name="current_weight_kg"
            inputMode="decimal"
            defaultValue={
              profile?.current_weight_kg == null
                ? ""
                : String(profile.current_weight_kg)
            }
            placeholder="Ej: 64.0"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Calorías base estimadas</p>
        <p className="mt-1 text-lg font-semibold">
          {profile?.bmr_kcal_current ?? "—"} kcal
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Se calculan con Harris–Benedict a partir de tus datos actuales.
        </p>
      </div>

      <Button className="h-11 w-full" type="submit">
        Guardar perfil
      </Button>
    </form>
  );
}
