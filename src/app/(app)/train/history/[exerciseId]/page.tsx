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
          {exercise?.name ?? "Ejercicio"}
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
                  {it.session.title ?? "Sesión"} · {it.sets.length} sets
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {it.sets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin sets cargados.</p>
                ) : (
                  <div className="space-y-2">
                    {it.sets.map((st) => (
                      <div
                        key={st.id}
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        Set {st.set_number}:{" "}
                        {st.reps !== null ? `${st.reps} reps` : "—"}{" "}
                        {st.weight_kg !== null ? `· ${st.weight_kg} kg` : ""}
                        {st.duration_seconds !== null ? ` · ${st.duration_seconds}s` : ""}
                        {st.distance_meters !== null ? ` · ${st.distance_meters}m` : ""}
                      </div>
                    ))}
                  </div>
                )}

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

