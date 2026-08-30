import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDateFieldValue } from "@/lib/date-field-display";
import { cn } from "@/lib/utils";
import { getNutritionDay } from "@/lib/nutrition/day";
import { getQuickMealCandidates } from "@/lib/nutrition/quick-meals";
import { getStepsOverview } from "@/lib/nutrition/steps-report";
import { listActiveFoods } from "@/lib/nutrition/product";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { TodayActivity } from "./today-activity";
import { MealComposer } from "./meal-composer";
import { MealList, type TodayMeal } from "./meal-list";

export const dynamic = "force-dynamic";

const gramFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

function formatKcal(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${n} kcal`;
}

function formatGrams(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${gramFormatter.format(n)} g`;
}

function formatLiters(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${gramFormatter.format(n)} L`;
}

function formatBalance(value: number | null) {
  if (value === null) return "Sin gasto configurado";
  if (value < 0) return `Déficit ${Math.abs(value)} kcal`;
  if (value > 0) return `Superávit ${value} kcal`;
  return "Balance 0 kcal";
}

function formatProteinProgress(consumed: number, target: number | null) {
  const value = gramFormatter.format(consumed);
  return target === null ? `${value} g` : `${value} / ${formatGrams(target)}`;
}

export default async function TodayPage() {
  const today = todayInCordoba();
  const auth = await requireAuthenticatedRequestContext();
  const [{ dayLog, meals, context }, stepsOverview, quickMeals, foods] = await Promise.all([
    getNutritionDay(today, undefined, auth),
    getStepsOverview(today, auth),
    getQuickMealCandidates(today, auth),
    listActiveFoods(auth),
  ]);
  const calories = dayLog.total_calories_consumed ?? 0;
  const target = context.targets.calories;
  const progress = target && target > 0 ? Math.min((calories / target) * 100, 100) : 0;
  const remaining = target === null ? null : target - calories;
  const mealListItems: TodayMeal[] = meals.map((meal) => ({
    id: meal.id,
    updated_at: meal.updated_at,
    title: meal.title,
    description: meal.description,
    final_calories: meal.final_calories,
    final_protein_g: meal.final_protein_g,
    final_carbs_g: meal.final_carbs_g,
    final_fat_g: meal.final_fat_g,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Nutrición de hoy</h1>
          <p className="text-sm text-muted-foreground">{formatDateFieldValue(dayLog.log_date)}</p>
        </div>
        <Link href="/today/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          <ChartNoAxesCombined className="size-4" aria-hidden /> Reportes
        </Link>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <aside className="space-y-4 lg:sticky lg:top-8 lg:col-span-4">
      <Card className="surface-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-xs text-muted-foreground">Calorías</p><p className="metric-number text-2xl font-semibold tracking-tight">{calories} <span className="text-sm font-medium text-muted-foreground">/ {target ?? "—"} kcal</span></p></div>
              <p className="text-right text-xs text-muted-foreground">{remaining === null ? "Sin objetivo configurado" : remaining >= 0 ? `Restan ${remaining} kcal` : `${Math.abs(remaining)} kcal por encima`}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Calorías del día" aria-valuemin={0} aria-valuemax={target ?? undefined} aria-valuenow={calories}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Proteína</p>
              <p className="metric-number mt-0.5 text-sm font-semibold">
                {formatProteinProgress(dayLog.total_protein_g, context.targets.proteinG)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carbos</p>
              <p className="metric-number mt-0.5 text-sm font-semibold">
                {formatGrams(dayLog.total_carbs_g)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grasas</p>
              <p className="metric-number mt-0.5 text-sm font-semibold">
                {formatGrams(dayLog.total_fat_g)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <MealComposer date={today} quickMeals={quickMeals} foods={foods} />

      </aside>

      <div className="lg:col-span-4 lg:col-start-1 lg:row-start-2">
        <TodayActivity
          dayLogId={dayLog.id}
          stepsInitial={dayLog.steps}
          waterInitial={dayLog.water_l}
          mateInitial={dayLog.mate_l}
          workOverride={dayLog.work_override}
          workReasonInitial={dayLog.work_override_reason}
          gymReasonInitial={dayLog.gym_override_reason}
          expenditureInitial={dayLog.expenditure_override_kcal}
          gymSource={context.gym.source}
          expenditureLabel={formatKcal(context.expenditureKcal)}
          balanceLabel={formatBalance(context.metrics.energyBalanceKcal)}
          workLabel={context.work.effective == null ? "—" : context.work.effective ? "Sí" : "No"}
          workSourceLabel={context.work.source === "override" ? "corrección" : context.work.source === "schedule" ? "horario" : "sin regla"}
          gymLabel={context.gym.effective ? "Sí" : "No"}
          gymSourceLabel={context.gym.source === "workout" ? "sesión" : context.gym.source === "override" ? "corrección" : "sin sesión"}
          waterTargetLabel={context.targets.waterL == null ? null : formatLiters(context.targets.waterL)}
          stepsSummary={stepsOverview.summary}
        />
      </div>

      <div className="min-w-0 lg:col-span-8 lg:col-start-5 lg:row-span-2 lg:row-start-1">
        <MealList meals={mealListItems} date={dayLog.log_date} />
      </div>
      </div>
    </div>
  );
}
