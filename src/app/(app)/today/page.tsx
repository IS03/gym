import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNutritionDay } from "@/lib/nutrition/day";
import { getQuickMealCandidates } from "@/lib/nutrition/quick-meals";
import { getStepsOverview } from "@/lib/nutrition/steps-report";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { softDeleteMealAction, updateMealAction } from "./actions";
import { TodayActivity } from "./today-activity";
import { MealComposer } from "./meal-composer";

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
  if (value < 0) return `Déficit estimado: ${Math.abs(value)} kcal`;
  if (value > 0) return `Superávit estimado: ${value} kcal`;
  return "Balance estimado: 0 kcal";
}

function formatProteinProgress(consumed: number, target: number | null) {
  const value = gramFormatter.format(consumed);
  return target === null ? `${value} g` : `${value} / ${formatGrams(target)}`;
}

function formatMealMacros(meal: {
  final_protein_g: number | null;
  final_carbs_g: number | null;
  final_fat_g: number | null;
}) {
  return [
    `P ${formatGrams(meal.final_protein_g)}`,
    `C ${formatGrams(meal.final_carbs_g)}`,
    `G ${formatGrams(meal.final_fat_g)}`,
  ].join(" · ");
}

export default async function TodayPage() {
  const today = todayInCordoba();
  const auth = await requireAuthenticatedRequestContext();
  const [{ dayLog, meals, context }, stepsOverview, quickMeals] = await Promise.all([
    getNutritionDay(today, undefined, auth),
    getStepsOverview(today, auth),
    getQuickMealCandidates(today, auth),
  ]);
  const calories = dayLog.total_calories_consumed ?? 0;
  const target = context.targets.calories;
  const progress = target && target > 0 ? Math.min((calories / target) * 100, 100) : 0;
  const remaining = target === null ? null : target - calories;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Nutrición de hoy</h1>
          <p className="text-sm text-muted-foreground">{dayLog.log_date}</p>
        </div>
        <Link href="/today/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          <ChartNoAxesCombined className="size-4" aria-hidden /> Reportes
        </Link>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <aside className="space-y-6 lg:sticky lg:top-8 lg:col-span-4">
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

      <MealComposer date={today} quickMeals={quickMeals} />

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
      </aside>

      <div className="space-y-3 lg:col-span-8">
        <h2 className="text-base font-semibold tracking-tight">Comidas</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no cargaste comidas.</p>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <Card key={meal.id} className="surface-elevated">
                <CardHeader className="pb-2">
                  {meal.title ? (
                    <CardTitle className="text-base">{meal.title}</CardTitle>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatKcal(meal.final_calories)}
                  </p>
                  <p className="metric-number mt-1 text-xs text-muted-foreground">
                    {formatMealMacros(meal)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meal.description ? (
                    <p className="text-sm text-muted-foreground">{meal.description}</p>
                  ) : null}

                  <details
                    key={`${meal.id}-${meal.updated_at}`}
                    className="rounded-md border bg-background p-3"
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      Editar
                    </summary>
                    <form action={updateMealAction} className="mt-3 space-y-3">
                      <input type="hidden" name="id" value={meal.id} />
                      <div className="space-y-1">
                        <Label htmlFor={`date-${meal.id}`}>Fecha</Label>
                        <DateField
                          id={`date-${meal.id}`}
                          name="date"
                          required
                          defaultValue={dayLog.log_date}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`t-${meal.id}`}>Título</Label>
                        <Input
                          id={`t-${meal.id}`}
                          name="title"
                          defaultValue={meal.title ?? ""}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`k-${meal.id}`}>Calorías</Label>
                          <Input
                            id={`k-${meal.id}`}
                            name="final_calories"
                            type="number"
                            min={1}
                            step={1}
                            required
                            inputMode="numeric"
                            defaultValue={
                              meal.final_calories === null ? "" : String(meal.final_calories)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`p-${meal.id}`}>Proteína</Label>
                          <Input
                            id={`p-${meal.id}`}
                            name="final_protein_g"
                            type="text"
                            min={0}
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            defaultValue={
                              meal.final_protein_g === null ? "" : String(meal.final_protein_g)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`c-${meal.id}`}>Carbohidratos</Label>
                          <Input
                            id={`c-${meal.id}`}
                            name="final_carbs_g"
                            type="text"
                            min={0}
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            defaultValue={
                              meal.final_carbs_g === null ? "" : String(meal.final_carbs_g)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`f-${meal.id}`}>Grasas</Label>
                          <Input
                            id={`f-${meal.id}`}
                            name="final_fat_g"
                            type="text"
                            min={0}
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            defaultValue={
                              meal.final_fat_g === null ? "" : String(meal.final_fat_g)
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`d-${meal.id}`}>Descripción</Label>
                        <Input
                          id={`d-${meal.id}`}
                          name="description"
                          defaultValue={meal.description ?? ""}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                          Confirmada (todas las comidas cuentan en el día)
                        </div>
                      </div>
                      <Button className="h-11 w-full" type="submit">
                        Guardar cambios
                      </Button>
                    </form>
                  </details>

                  <details className="rounded-xl border border-destructive/20 px-3 py-2">
                    <summary className="cursor-pointer text-sm text-muted-foreground">Más acciones</summary>
                  <form action={softDeleteMealAction} className="mt-2">
                    <input type="hidden" name="id" value={meal.id} />
                    <Button className="h-10 w-full" type="submit" size="sm" variant="destructive">
                      Borrar
                    </Button>
                  </form>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
