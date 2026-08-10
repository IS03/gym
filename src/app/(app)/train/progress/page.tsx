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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Progreso</h1>
        <p className="text-sm text-muted-foreground">
          Solo cuenta sesiones finalizadas y series marcadas como hechas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold">{currentWeek?.sessions ?? 0}</div>
            <div className="text-xs text-muted-foreground">Sesiones esta semana</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold">{currentWeek?.sets ?? 0}</div>
            <div className="text-xs text-muted-foreground">Series esta semana</div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Resumen semanal</h2>
        {progress.weeks.slice(0, 12).map((week) => (
          <Card key={week.weekStart}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {week.weekStart} al {week.weekEnd}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-md border p-2">
                  <div className="font-semibold">{week.sessions}</div>
                  <div className="text-muted-foreground">Sesiones</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-semibold">{week.exercises}</div>
                  <div className="text-muted-foreground">Ejercicios</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-semibold">{week.sets}</div>
                  <div className="text-muted-foreground">Series</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-semibold">{week.minutes}</div>
                  <div className="text-muted-foreground">Minutos</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Volumen registrado: {rounded(week.volumeKg)} kg
              </p>
              {Object.keys(week.routines).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(week.routines).map(([name, sessions]) => (
                    <span key={name} className="rounded-full border px-2 py-1 text-xs">
                      {name}: {sessions}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin entrenamientos.</p>
              )}
            </CardContent>
          </Card>
        ))}
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
