import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExerciseHistory, listExercises } from "@/lib/phase2/training";

export const dynamic = "force-dynamic";

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;

  const [allExercises, items] = await Promise.all([
    listExercises({ includeArchived: false }),
    listExerciseHistory({ exerciseId, limitSessions: 20 }),
  ]);

  const exercise = allExercises.find((e) => e.id === exerciseId) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {exercise?.nombre ?? "Ejercicio"}
        </h1>
        <p className="text-sm text-muted-foreground">Últimas sesiones.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay historial.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.sessionExercise.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{it.day_log_date}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {it.sessionExercise.series_reales ?? "—"}x{it.sessionExercise.reps_reales ?? "—"}
                  {it.sessionExercise.peso_real !== null && it.sessionExercise.peso_real !== undefined
                    ? ` · ${it.sessionExercise.peso_real} kg`
                    : ""}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {it.sessionExercise.is_completed ? "Hecho" : "No marcado como hecho"}
                </div>

                <Link
                  href={`/train/session/${it.session.id}`}
                  className="block text-sm font-medium underline"
                >
                  Ver sesión
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link href="/train/history" className="text-sm font-medium underline">
        Volver
      </Link>
    </div>
  );
}

