import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTrainingProgress } from "@/lib/phase2/training-robust";
import type { TrainingAdjustment } from "@/lib/phase2/types";

export const dynamic = "force-dynamic";

const ADJUSTMENT_LABELS: Record<TrainingAdjustment, string> = {
  maintain: "Mantener",
  increase_weight: "+ Peso",
  increase_reps: "+ Repeticiones",
  custom: "Personalizado",
};

function rounded(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

export default async function TrainingProgressPage() {
  const progress = await getTrainingProgress();
  const currentWeek = progress.weeks[0];
  const weeklyVolumeMax = Math.max(...progress.weeks.slice(0, 8).map((week) => week.volumeKg), 1);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Progreso</h1>
        <p className="text-sm text-muted-foreground">
          Solo cuenta sesiones finalizadas y series marcadas como hechas.
        </p>
      </div>

      <Card className="surface-elevated">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Esta semana</p>
          <div className="mt-3 grid grid-cols-4 divide-x divide-border text-center">
            <div><p className="metric-number text-xl font-semibold">{currentWeek?.sessions ?? 0}</p><p className="text-[11px] text-muted-foreground">Sesiones</p></div>
            <div><p className="metric-number text-xl font-semibold">{currentWeek?.sets ?? 0}</p><p className="text-[11px] text-muted-foreground">Series</p></div>
            <div><p className="metric-number text-xl font-semibold">{currentWeek?.minutes ?? 0}</p><p className="text-[11px] text-muted-foreground">Minutos</p></div>
            <div><p className="metric-number text-xl font-semibold">{rounded(currentWeek?.volumeKg ?? 0)}</p><p className="text-[11px] text-muted-foreground">Volumen</p></div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Evolución semanal</h2>
        <Card className="surface-elevated">
          <CardContent className="pt-4">
            {progress.weeks.length === 0 ? <p className="text-sm text-muted-foreground">Necesitamos algunas sesiones para mostrar tu evolución.</p> : <div className="flex h-36 items-end gap-2" aria-label="Volumen por semana">
              {progress.weeks.slice(0, 8).reverse().map((week) => (
                <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="metric-number text-[10px] text-muted-foreground">{week.sessions || ""}</span>
                  <div className="flex h-24 w-full items-end rounded-md bg-muted/70"><div className="w-full rounded-md bg-primary transition-[height] duration-200" style={{ height: `${Math.max((week.volumeKg / weeklyVolumeMax) * 100, week.volumeKg > 0 ? 8 : 0)}%` }} title={`${rounded(week.volumeKg)} kg`} /></div>
                  <span className="text-[10px] text-muted-foreground">{week.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Por ejercicio</h2>
        {progress.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Finalizá una sesión para empezar a ver progreso.
          </p>
        ) : (
          progress.exercises.map((exercise) => (
            <Card key={exercise.exerciseId}>
              <CardHeader className="space-y-1 pb-3">
                <CardTitle className="text-base">{exercise.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {exercise.muscleGroup ?? "Sin grupo"} · última vez {exercise.lastDate}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border p-2">
                    <div className="font-semibold">{exercise.sessions}</div>
                    <div className="text-muted-foreground">Sesiones</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="font-semibold">
                      {exercise.bestWeightKg === null ? "—" : exercise.bestWeightKg}
                    </div>
                    <div className="text-muted-foreground">Mejor kg</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="font-semibold">{rounded(exercise.totalVolumeKg)}</div>
                    <div className="text-muted-foreground">Volumen kg</div>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Últimas series: </span>
                    {exercise.lastSets.length === 0
                      ? "—"
                      : exercise.lastSets
                          .map(
                            (set) =>
                              `${set.actual_reps ?? "—"}×${set.actual_weight_kg ?? "—"}`,
                          )
                          .join(" · ")}
                  </p>
                  <p>
                    <span className="font-medium">Próxima vez: </span>
                    {ADJUSTMENT_LABELS[exercise.lastDecision]}
                  </p>
                </div>
                <Link
                  href={`/train/history/${exercise.exerciseId}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-10 w-full")}
                >
                  Ver historial
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Link
        href="/train"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
      >
        Volver a Entrenar
      </Link>
    </div>
  );
}
