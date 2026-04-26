import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listEndedSessionsByDate, listRoutines } from "@/lib/phase2/training";

export const dynamic = "force-dynamic";

export default async function TrainDayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const date = typeof sp.date === "string" ? sp.date : new Date().toISOString().slice(0, 10);
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";

  const [routines, sessions] = await Promise.all([
    listRoutines({ includeArchived: false }),
    listEndedSessionsByDate({ date, routineId: routineId || null }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{date}</h1>
        <p className="text-sm text-muted-foreground">Sesiones terminadas.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtro</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/train/day" className="flex gap-2">
            <input type="hidden" name="date" value={date} />
            <select
              name="routine_id"
              defaultValue={routineId}
              className="h-11 flex-1 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">(Todas)</option>
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <button className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay sesiones terminadas ese día.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.session.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {s.routineNombre ?? "Sesión libre"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {s.completedCount}/{s.exercisesCount} ejercicios hechos
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  href={`/train/session/${s.session.id}`}
                  className="text-sm font-medium underline"
                >
                  Ver sesión
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/train/calendar" className="text-sm font-medium underline">
        Volver al calendario
      </Link>
    </div>
  );
}

