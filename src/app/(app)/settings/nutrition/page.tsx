import { Utensils } from "lucide-react";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { getNutritionPlanEditor } from "@/lib/nutrition/plan-v2";
import { NutritionPlanEditor } from "./nutrition-plan-editor";
import { NutritionFeatureHeader } from "./nutrition-feature-header";

export const dynamic = "force-dynamic";

export default async function NutritionSettingsPage() {
  const today = todayInCordoba();
  const plan = await getNutritionPlanEditor(today);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <NutritionFeatureHeader
        title="Plan nutricional"
        description="Objetivos, calorías y ajustes de tu semana."
        backHref="/settings"
        backLabel="Ajustes"
        icon={Utensils}
      />
      <NutritionPlanEditor initial={plan} />
    </div>
  );
}
