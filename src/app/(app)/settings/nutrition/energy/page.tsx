import { Flame } from "lucide-react";
import { getEnergyConfigEditor } from "@/lib/nutrition/plan-v2";
import { calculateAgeOnDate } from "@/lib/nutrition/plan-v2-core";
import { getAuthedUser, getProfileForUser } from "@/lib/phase1/profile";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { NutritionFeatureHeader } from "../nutrition-feature-header";
import { EnergyConfigEditor } from "./energy-config-editor";

export const dynamic = "force-dynamic";

export default async function EnergySettingsPage() {
  const today = todayInCordoba();
  const user = await getAuthedUser();
  const [profile, config] = await Promise.all([
    getProfileForUser(user.id),
    getEnergyConfigEditor(today),
  ]);
  const age = profile?.birth_date ? calculateAgeOnDate(profile.birth_date, today) : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <NutritionFeatureHeader
        title="Cálculo energético"
        description="Estimamos tu gasto base según tus datos y tu actividad diaria."
        backHref="/settings/nutrition"
        backLabel="Plan nutricional"
        icon={Flame}
      />
      <EnergyConfigEditor
        initial={config}
        profile={{
          age,
          sex: profile?.sex ?? null,
          heightCm: profile?.height_cm ?? null,
          weightKg: profile?.current_weight_kg ?? null,
          bmrKcal: profile?.bmr_kcal_current ?? null,
        }}
      />
    </div>
  );
}
