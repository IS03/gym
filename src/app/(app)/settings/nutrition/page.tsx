import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listNutritionConfiguration } from "@/lib/nutrition/product";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { NutritionSettingsForms } from "./nutrition-settings-forms";
import { FoodsCatalog } from "./foods-catalog";
import { listIntegrationApiTokens } from "@/lib/integrations/chatgpt-tokens";
import { ChatgptIntegration } from "./chatgpt-integration";

export const dynamic = "force-dynamic";

export default async function NutritionSettingsPage() {
  const [config, integrationTokens] = await Promise.all([
    listNutritionConfiguration(),
    listIntegrationApiTokens(),
  ]);
  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="space-y-2">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Ajustes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Nutrición</h1>
        <p className="text-sm text-muted-foreground">Objetivos, gasto, horario habitual y alimentos. Cada cambio de configuración crea una nueva versión.</p>
      </div>
      <NutritionSettingsForms
        goals={config.goals}
        expenditure={config.expenditure}
        schedules={config.schedules}
        today={todayInCordoba()}
      />
      <FoodsCatalog initialFoods={config.foods} />
      <ChatgptIntegration initialTokens={integrationTokens} />
    </div>
  );
}
