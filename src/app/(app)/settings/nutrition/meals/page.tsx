import Link from "next/link";
import { ArrowLeft, CookingPot } from "lucide-react";
import { listActiveFoods } from "@/lib/nutrition/product";
import { listSavedMeals } from "@/lib/nutrition/saved-meals";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { SavedMealsCatalog } from "../saved-meals-catalog";

export const dynamic = "force-dynamic";

export default async function SavedMealsSettingsPage() {
  const auth = await requireAuthenticatedRequestContext();
  const [meals, foods] = await Promise.all([
    listSavedMeals(auth),
    listActiveFoods(auth),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16 lg:pb-0">
      <div className="space-y-2">
        <Link href="/settings/nutrition" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Nutrición
        </Link>
        <div className="flex items-center gap-2">
          <CookingPot className="size-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Comidas habituales</h1>
        </div>
        <p className="text-sm text-muted-foreground">Preparaciones que decidís guardar y repetir.</p>
      </div>
      <SavedMealsCatalog initialMeals={meals} foods={foods} />
    </div>
  );
}
