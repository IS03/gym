import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listExercises } from "@/lib/phase2/training";
import { listRobustExerciseHistory } from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

function bestRecordedWeight(sets: Array<{ actual_weight_kg: number | null }>) {
  const weights = sets.flatMap((set) =>
    typeof set.actual_weight_kg === "number" ? [set.actual_weight_kg] : [],
  );
  return weights.length ? Math.max(...weights) : null;
}

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const { exerciseId } = await params;

  const [allExercises, items] = await Promise.all([
    listExercises({ includeArchived: false }),
    listRobustExerciseHistory({ exerciseId, limit: 20 }),
  ]);

  const exercise = allExercises.find((e) => e.id === exerciseId) ?? null;

  return (
    <div className="space-y-6 lg:mx-auto lg:max-w-5xl">
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
          {items.map((item, index) => {
            const previous = items[index + 1];
            const currentBest = bestRecordedWeight(item.exercise.sets);
            const previousBest = previous ? bestRecordedWeight(previous.exercise.sets) : null;
            const difference =
              currentBest !== null && previousBest !== null ? currentBest - previousBest : null;
            return (
            <Card key={item.exercise.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{item.logDate}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {item.session.routine_name_snapshot ??
                    item.session.session_name ??
                    "Sesión libre"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {difference !== null && difference !== 0 ? (
                  <p className={cn("metric-number rounded-xl px-3 py-2 text-sm font-medium", difference > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                    {difference > 0 ? "+" : ""}{difference} kg frente a la sesión anterior
                  </p>
                ) : null}
                <div className="space-y-2">
                  {item.exercise.sets.map((set) => (
                    <div
                      key={set.id}
                      className="grid grid-cols-[52px_1fr_1fr] gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">S{set.set_number}</span>
                      <span>
                        Real: {set.actual_reps ?? "—"} × {set.actual_weight_kg ?? "—"} kg
                      </span>
                      <span className="text-muted-foreground">
                        Obj: {set.target_reps ?? "—"} × {set.target_weight_kg ?? "—"}
                        {set.target_rir !== null ? ` · RIR ${set.target_rir}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/train/session/${item.session.id}`}
                  className="block text-sm font-medium underline"
                >
                  Ver sesión
                </Link>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Link href="/train/history" className="text-sm font-medium underline">
        Volver
      </Link>
    </div>
  );
}
