import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getNutritionDay } from "@/lib/nutrition/day";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { CreateMealForm } from "./create-meal-form";
import { softDeleteMealAction, updateMealAction } from "./actions";
import { DayContextEditor } from "./day-context-editor";

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
  const { dayLog, meals, context } = await getNutritionDay(today);
  const calories = dayLog.total_calories_consumed ?? 0;
  const target = context.targets.calories;
  const progress = target && target > 0 ? Math.min((calories / target) * 100, 100) : 0;
  const remaining = target === null ? null : target - calories;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Nutrición de hoy</h1>
        <p className="text-sm text-muted-foreground">{dayLog.log_date}</p>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto del día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Gasto estimado</p><p className="font-semibold">{formatKcal(context.expenditureKcal)}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance energético</p><p className="font-semibold">{formatBalance(context.metrics.energyBalanceKcal)}</p></div>
            <div><p className="text-xs text-muted-foreground">Trabajo</p><p className="font-semibold">{context.work.effective == null ? "—" : context.work.effective ? "Sí" : "No"} <span className="font-normal text-muted-foreground">· {context.work.source === "override" ? "corrección" : context.work.source === "schedule" ? "horario" : "sin regla"}</span></p></div>
            <div><p className="text-xs text-muted-foreground">Entrenamiento</p><p className="font-semibold">{context.gym.effective ? "Sí" : "No"} <span className="font-normal text-muted-foreground">· {context.gym.source === "workout" ? "sesión" : context.gym.source === "override" ? "corrección" : "sin sesión"}</span></p></div>
            <div><p className="text-xs text-muted-foreground">Agua</p><p className="font-semibold">{formatLiters(dayLog.water_l)}{context.targets.waterL == null ? "" : ` / ${formatLiters(context.targets.waterL)}`}</p></div>
            <div><p className="text-xs text-muted-foreground">Pasos</p><p className="font-semibold">{dayLog.steps == null ? "—" : gramFormatter.format(dayLog.steps)}</p></div>
          </div>
          <div className="border-t pt-4">
            <DayContextEditor
              dayLogId={dayLog.id}
              stepsInitial={dayLog.steps}
              waterInitial={dayLog.water_l}
              mateInitial={dayLog.mate_l}
              workOverride={dayLog.work_override}
              workReasonInitial={dayLog.work_override_reason}
              gymReasonInitial={dayLog.gym_override_reason}
              expenditureInitial={dayLog.expenditure_override_kcal}
              gymSource={context.gym.source}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva comida</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMealForm date={today} />
        </CardContent>
      </Card>
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
                            type="number"
                            min={0}
                            step="0.1"
                            inputMode="decimal"
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
                            type="number"
                            min={0}
                            step="0.1"
                            inputMode="decimal"
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
                            type="number"
                            min={0}
                            step="0.1"
                            inputMode="decimal"
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
