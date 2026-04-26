import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listRoutines, listTrainingDaysInMonth } from "@/lib/phase2/training";

export const dynamic = "force-dynamic";

function isoMonth(d: Date) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return isoMonth(dt);
}

function monthGrid(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // lunes=0
  const start = new Date(Date.UTC(y, m - 1, 1 - startDow));

  const days: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    days.push({ date, inMonth: d.getUTCMonth() === m - 1 });
  }
  return days;
}

export default async function TrainCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const month = typeof sp.month === "string" ? sp.month : isoMonth(new Date());
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";

  const [routines, trainedDays] = await Promise.all([
    listRoutines({ includeArchived: false }),
    listTrainingDaysInMonth({
      month: month as `${number}-${number}`,
      routineId: routineId || null,
    }),
  ]);

  const days = monthGrid(month);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Días entrenados (sesiones terminadas).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action="/train/calendar" className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Mes</label>
                <input
                  name="month"
                  defaultValue={month}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                  placeholder="YYYY-MM"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Rutina</label>
                <select
                  name="routine_id"
                  defaultValue={routineId}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">(Todas)</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button className="h-11 w-full" type="submit" variant="outline">
              Aplicar
            </Button>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/train/calendar?month=${addMonths(month, -1)}${routineId ? `&routine_id=${routineId}` : ""}`}
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
            >
              ← Mes anterior
            </Link>
            <Link
              href={`/train/calendar?month=${addMonths(month, 1)}${routineId ? `&routine_id=${routineId}` : ""}`}
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
            >
              Mes siguiente →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{month}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((d) => {
              const day = d.date.slice(8, 10);
              const colors = trainedDays.get(d.date) ?? [];
              const trained = colors.length > 0;
              return (
                <Link
                  key={d.date}
                  href={`/train/day?date=${d.date}${routineId ? `&routine_id=${routineId}` : ""}`}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md border text-sm",
                    d.inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                    trained ? "border-foreground font-semibold" : "border-border",
                  )}
                >
                  <div className="flex flex-col items-center leading-none">
                    <div>{day}</div>
                    {trained ? (
                      <div className="mt-1 flex gap-1">
                        {colors.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="inline-block size-1.5 rounded-full"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Borde resaltado = día con al menos una sesión terminada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

