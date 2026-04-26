"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/lib/phase1/profile";
import { saveProfileAction } from "./profile-actions";

type ProfileFormProps = {
  email: string | null;
  profile: Profile | null;
};

export function ProfileForm({ email, profile }: ProfileFormProps) {
  const initial = useMemo(() => {
    return {
      display_name: profile?.display_name ?? "",
      birth_date: profile?.birth_date ?? "",
      sex: profile?.sex ?? "",
      height_cm: profile?.height_cm == null ? "" : String(profile.height_cm),
      current_weight_kg:
        profile?.current_weight_kg == null ? "" : String(profile.current_weight_kg),
    };
  }, [
    profile?.display_name,
    profile?.birth_date,
    profile?.sex,
    profile?.height_cm,
    profile?.current_weight_kg,
  ]);

  const [displayName, setDisplayName] = useState(initial.display_name);
  const [birthDate, setBirthDate] = useState(initial.birth_date);
  const [sex, setSex] = useState(initial.sex);
  const [heightCm, setHeightCm] = useState(initial.height_cm);
  const [weightKg, setWeightKg] = useState(initial.current_weight_kg);

  return (
    <form action={saveProfileAction} className="space-y-3">
      <p className="text-xs text-muted-foreground">{email ?? "—"}</p>

      <div className="space-y-1">
        <Label htmlFor="display_name">Nombre</Label>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sex">Género</Label>
          <select
            id="sex"
            name="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
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
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="Ej: 178"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="current_weight_kg">Peso (kg)</Label>
          <Input
            id="current_weight_kg"
            name="current_weight_kg"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="Ej: 82.4"
          />
        </div>
      </div>

      <div className="rounded-md border bg-background px-4 py-3">
        <p className="text-xs text-muted-foreground">Mantenimiento (estimado)</p>
        <p className="mt-1 text-lg font-semibold">
          {profile?.maintenance_kcal_current ?? "—"} kcal
        </p>
        <p className="text-xs text-muted-foreground">
          Fórmula de Harris–Benedict (según género, edad, altura y peso).
        </p>
      </div>

      <Button className="h-11 w-full" type="submit">
        Guardar perfil
      </Button>
    </form>
  );
}

