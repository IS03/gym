import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listRecentDays } from "@/lib/phase1/day-log";
import { getNutritionDay } from "@/lib/nutrition/day";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { listNutritionEvents } from "@/lib/nutrition/product";

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

function formatLiters(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${gramFormatter.format(n)} L`;
}

function balanceLabel(value: number | null) {
  if (value === null) return "—";
  if (value < 0) return `Déficit estimado: ${Math.abs(value)} kcal`;
  if (value > 0) return `Superávit estimado: ${value} kcal`;
  return "Balance estimado: 0 kcal";
}

function adjacentDate(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function originalTimeKnown(rawInput: string | null) {
  if (!rawInput) return true;
  try { return (JSON.parse(rawInput) as { originalTimeKnown?: boolean }).originalTimeKnown !== false; }
  catch { return true; }
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const date = typeof sp.date === "string" ? sp.date : null;

  const today = todayInCordoba();

  if (!date) {
    const days = await listRecentDays(60);
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial diario</h1>
          <p className="text-sm text-muted-foreground">
            Elegí una fecha para ver el resumen y sus comidas.
          </p>
        </div>

        <div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
        <Card className="lg:order-2 lg:col-span-4 lg:sticky lg:top-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ir a una fecha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action="/history" className="flex gap-2">
              <input
                type="date"
                name="date"
                defaultValue={today}
                className="h-11 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <Button className="h-11" type="submit">
                Ver
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3 lg:order-1 lg:col-span-8">
          <h2 className="text-base font-semibold tracking-tight">Últimos días</h2>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay días todavía.</p>
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {days.map((d) => (
                <Link
                  key={d.id}
                  href={`/history?date=${d.log_date}`}
                  className="block rounded-md border bg-background px-4 py-3"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{d.log_date}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatKcal(d.total_calories_consumed)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  const [nutritionDay, events] = await Promise.all([
    getNutritionDay(date, { createIfMissing: false }),
    listNutritionEvents(date),
  ]);
  const { dayLog, meals, context } = nutritionDay;

  if (!dayLog) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial diario</h1>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <Card>
          <CardContent className="space-y-4 py-6">
            <p className="text-sm text-muted-foreground">
              No existe un registro para esa fecha.
            </p>
            <form action="/history" className="flex gap-2">
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="h-11 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <Button className="h-11" type="submit" variant="outline">
                Cambiar fecha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial diario</h1>
        <p className="text-sm text-muted-foreground">{dayLog.log_date}</p>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0">
      <Card className="lg:col-span-4 lg:sticky lg:top-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen del día</CardTitle>
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
            <span className="text-sm">{formatKcal(context.targets.calories)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Delta</span>
            <span className="text-sm">
              {context.metrics.deltaVsNutritionTarget === null
                ? "—"
                : `${context.metrics.deltaVsNutritionTarget >= 0 ? "+" : ""}${context.metrics.deltaVsNutritionTarget} kcal`}
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Proteína</span>
              <span className="text-sm">
                {formatProteinProgress(dayLog.total_protein_g, context.targets.proteinG)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Carbohidratos</span>
              <span className="text-sm">{formatGrams(dayLog.total_carbs_g)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Grasas</span>
              <span className="text-sm">{formatGrams(dayLog.total_fat_g)}</span>
            </div>
          </div>
          <div className="space-y-2 border-t pt-2">
            <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Gasto estimado</span><span className="text-sm">{formatKcal(context.expenditureKcal)}</span></div>
            <div className="flex items-baseline justify-between gap-4"><span className="text-sm text-muted-foreground">Balance energético</span><span className="text-right text-sm">{balanceLabel(context.metrics.energyBalanceKcal)}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-2 text-sm">
            <div><span className="text-muted-foreground">Agua</span><p>{formatLiters(dayLog.water_l)}{context.targets.waterL == null ? "" : ` / ${formatLiters(context.targets.waterL)}`}</p></div>
            <div><span className="text-muted-foreground">Mate</span><p>{formatLiters(dayLog.mate_l)}</p></div>
            <div><span className="text-muted-foreground">Pasos</span><p>{dayLog.steps == null ? "—" : gramFormatter.format(dayLog.steps)}</p></div>
            <div><span className="text-muted-foreground">Peso</span><p>{dayLog.weight_kg == null ? "—" : `${gramFormatter.format(dayLog.weight_kg)} kg`}</p></div>
            <div><span className="text-muted-foreground">Trabajo</span><p>{context.work.effective == null ? "—" : context.work.effective ? "Sí" : "No"}</p></div>
            <div><span className="text-muted-foreground">Gym</span><p>{context.gym.effective ? "Sí" : "No"}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 lg:col-span-8">
        <h2 className="text-base font-semibold tracking-tight">Comidas</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay comidas activas ese día.</p>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => {
              const legacySummary = m.entry_kind === "legacy_daily_summary";
              return (
              <div key={m.id} className="rounded-md border bg-background px-4 py-3">
                <div className="flex items-baseline justify-between">
                  {legacySummary ? (
                    <span className="text-sm font-medium">Resumen diario histórico</span>
                  ) : m.title ? (
                    <span className="text-sm font-medium">{m.title}</span>
                  ) : (
                    <span className="text-sm font-medium" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatKcal(m.final_calories)}
                  </span>
                </div>
                <p className="metric-number mt-1 text-xs text-muted-foreground">
                  {formatMealMacros(m)}
                </p>
                {legacySummary ? <p className="mt-1 text-xs text-muted-foreground">Sin desglose de comidas disponible.</p> : null}
                {!legacySummary && !originalTimeKnown(m.raw_input) ? <p className="mt-1 text-xs text-muted-foreground">Horario no informado.</p> : null}
                {m.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                ) : null}
              </div>
            );})}
          </div>
        )}

        {events.length > 0 ? <section className="space-y-2 pt-3" aria-labelledby="events-title"><h2 id="events-title" className="text-base font-semibold">Eventos / permitidos</h2>{events.map((event) => <Card key={event.id}><CardContent className="space-y-1 pt-4"><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-medium">{event.event_type}</p>{event.intensity ? <span className="text-xs text-muted-foreground">{event.intensity}</span> : null}</div><p className="text-xs text-muted-foreground">Planificado: {event.planned == null ? "No informado" : event.planned ? "Sí" : "No"} · Alcohol: {event.alcohol == null ? "No informado" : event.alcohol ? "Sí" : "No"}{event.drinks_equivalent == null ? "" : ` · ${gramFormatter.format(event.drinks_equivalent)} tragos eq.`}</p>{event.context ? <p className="text-sm text-muted-foreground">{event.context}</p> : null}{event.notes ? <p className="text-sm text-muted-foreground">{event.notes}</p> : null}{event.event_calories == null ? null : <p className="text-xs text-muted-foreground">{event.event_calories} kcal estimadas del evento · sólo contexto</p>}</CardContent></Card>)}</section> : null}
      </div>
      </div>

      <div className="space-y-2 lg:ml-auto lg:w-[420px]">
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/history?date=${adjacentDate(dayLog.log_date, -1)}`} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Día anterior</Link>
          <Link href={`/history?date=${adjacentDate(dayLog.log_date, 1)}`} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Día siguiente</Link>
        </div>
        <form action="/history" className="flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={dayLog.log_date}
            className="h-11 flex-1 rounded-md border bg-background px-3 text-sm"
          />
          <Button className="h-11" type="submit" variant="outline">
            Cambiar fecha
          </Button>
        </form>
        <Link
          href="/today"
          className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
        >
          Volver a Hoy
        </Link>
      </div>
    </div>
  );
}
