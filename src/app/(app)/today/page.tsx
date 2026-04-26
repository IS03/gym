import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getDayLogWithMeals } from "@/lib/phase1/day-log";
import {
  createMealAction,
  softDeleteMealAction,
  updateMealAction,
} from "./actions";

export const dynamic = "force-dynamic";

function formatKcal(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${n} kcal`;
}

function formatProtein(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${n.toFixed(0)} g`;
}

export default async function TodayPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { dayLog, meals } = await getDayLogWithMeals(today);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hoy</h1>
        <p className="text-sm text-muted-foreground">{dayLog.log_date}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Consumidas</span>
            <span className="text-lg font-semibold">
              {formatKcal(dayLog.total_calories_consumed)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Target</span>
            <span className="text-sm">
              {formatKcal(dayLog.target_kcal_snapshot)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Delta</span>
            <span className="text-sm">
              {dayLog.delta_vs_target === null
                ? "—"
                : `${dayLog.delta_vs_target >= 0 ? "+" : ""}${dayLog.delta_vs_target} kcal`}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Proteína</span>
            <span className="text-sm">{formatProtein(dayLog.total_protein_g)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva comida</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMealAction} className="space-y-3">
            <input type="hidden" name="date" value={today} />
            <div className="space-y-1">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" placeholder="Ej: Yogur + granola" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="final_calories">Calorías</Label>
              <Input
                id="final_calories"
                name="final_calories"
                type="number"
                min={1}
                step={1}
                required
                inputMode="numeric"
                placeholder="Ej: 420"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="final_protein_g">Proteína (g)</Label>
              <Input
                id="final_protein_g"
                name="final_protein_g"
                inputMode="numeric"
                placeholder="Ej: 30"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                name="description"
                placeholder="Opcional"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11 w-full" type="submit">
                Agregar comida
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Comidas</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no cargaste comidas.</p>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <Card key={meal.id}>
                <CardHeader className="pb-3">
                  {meal.title ? (
                    <CardTitle className="text-base">{meal.title}</CardTitle>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {formatKcal(meal.final_calories)} · {formatProtein(meal.final_protein_g)}
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
                            inputMode="numeric"
                            defaultValue={
                              meal.final_protein_g === null ? "" : String(meal.final_protein_g)
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

                  <form action={softDeleteMealAction}>
                    <input type="hidden" name="id" value={meal.id} />
                    <Button className="h-11 w-full" type="submit" variant="destructive">
                      Borrar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
