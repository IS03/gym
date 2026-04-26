import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDayLogWithMeals, listRecentDays } from "@/lib/phase1/day-log";

export const dynamic = "force-dynamic";

function formatKcal(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${n} kcal`;
}

function formatProtein(n: number | null | undefined) {
  if (typeof n !== "number") return "—";
  return `${n.toFixed(0)} g`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const date = typeof sp.date === "string" ? sp.date : null;

  const today = new Date().toISOString().slice(0, 10);

  if (!date) {
    const days = await listRecentDays(14);
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
          <p className="text-sm text-muted-foreground">
            Elegí una fecha para ver el resumen y sus comidas.
          </p>
        </div>

        <Card>
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

        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Últimos días</h2>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay días todavía.</p>
          ) : (
            <div className="space-y-2">
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
    );
  }

  const { dayLog, meals } = await getDayLogWithMeals(date);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">{dayLog.log_date}</p>
      </div>

      <Card>
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
            <span className="text-sm">{formatKcal(dayLog.target_kcal_snapshot)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Delta</span>
            <span className="text-sm">
              {dayLog.delta_vs_target === null
                ? "—"
                : `${dayLog.delta_vs_target >= 0 ? "+" : ""}${dayLog.delta_vs_target} kcal`}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Comidas</h2>
        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay comidas activas ese día.</p>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => (
              <div key={m.id} className="rounded-md border bg-background px-4 py-3">
                <div className="flex items-baseline justify-between">
                  {m.title ? (
                    <span className="text-sm font-medium">{m.title}</span>
                  ) : (
                    <span className="text-sm font-medium" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatKcal(m.final_calories)} · {formatProtein(m.final_protein_g)}
                  </span>
                </div>
                {m.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
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
