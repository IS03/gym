import Link from "next/link";
import { Activity, Clock3, Dumbbell, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MuscleDistribution, WeeklyVolumeChart } from "@/components/training/training-insights";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTrainingMinutes } from "@/lib/phase2/training-progress-summary";
import { getTrainingProgress } from "@/lib/phase2/training-robust";
import type { TrainingAdjustment, WeeklyTrainingSummary } from "@/lib/phase2/types";

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

function descendingEntries(values: Record<string, number>) {
  return Object.entries(values).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, "es"),
  );
}

function formatWeekRange(week: WeeklyTrainingSummary) {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Cordoba",
  });
  const start = formatter.format(new Date(`${week.weekStart}T12:00:00Z`)).replace(".", "");
  const end = formatter.format(new Date(`${week.weekEnd}T12:00:00Z`)).replace(".", "");
  return `${start} – ${end}`;
}

function comparisonLabel(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return "=";
  return difference > 0 ? `↑ ${difference}` : `↓ ${Math.abs(difference)}`;
}

export default async function TrainingProgressPage() {
  const progress = await getTrainingProgress();
  const currentWeek = progress.weeks[0];
  const previousWeek = progress.weeks[1];
  const hasPreviousWeek = Boolean(previousWeek && previousWeek.sessions > 0);
  const routines = descendingEntries(currentWeek?.routines ?? {});
  const muscleGroups = descendingEntries(currentWeek?.muscleGroups ?? {});
  const weeklyVolumeMax = Math.max(...progress.weeks.slice(0, 8).map((week) => week.volumeKg), 1);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso</h1>
        <p className="text-sm text-muted-foreground">
          Solo cuenta sesiones finalizadas y series marcadas como hechas.
        </p>
      </div>

      <div className="space-y-6 lg:hidden">
      <Card className="surface-elevated">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Esta semana</p>
          <div className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
            <div><p className="metric-number text-xl font-semibold">{currentWeek?.sessions ?? 0}</p><p className="text-[11px] text-muted-foreground">Sesiones</p></div>
            <div><p className="metric-number text-xl font-semibold">{currentWeek?.sets ?? 0}</p><p className="text-[11px] text-muted-foreground">Series</p></div>
            <div><p className="metric-number text-base font-semibold">{formatTrainingMinutes(currentWeek?.minutes ?? 0)}</p><p className="text-[11px] text-muted-foreground">Duración</p></div>
          </div>
        </CardContent>
      </Card>

      <section id="weekly-report" className="scroll-mt-4 space-y-3" aria-labelledby="weekly-report-title">
        <h2 id="weekly-report-title" className="text-base font-semibold tracking-tight">Reporte semanal</h2>
        <Card className="surface-elevated">
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                {currentWeek ? `Semana ${formatWeekRange(currentWeek)}` : "Esta semana"}
              </p>
              <p className="text-sm text-muted-foreground">Solo sesiones y series finalizadas.</p>
            </div>

            <div className="grid grid-cols-3 gap-3 border-y border-border/70 py-3 text-center">
              <div><p className="metric-number text-xl font-semibold">{currentWeek?.sessions ?? 0}</p><p className="text-[11px] text-muted-foreground">Entrenamientos</p></div>
              <div><p className="metric-number text-base font-semibold">{formatTrainingMinutes(currentWeek?.minutes ?? 0)}</p><p className="text-[11px] text-muted-foreground">Duración</p></div>
              <div><p className="metric-number text-xl font-semibold">{currentWeek?.sets ?? 0}</p><p className="text-[11px] text-muted-foreground">Series</p></div>
            </div>

            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Volumen</span>
              <span className="metric-number font-semibold">{rounded(currentWeek?.volumeKg ?? 0)} kg</span>
            </div>

            {routines.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rutinas</h3>
                <div className="space-y-2 text-sm">
                  {routines.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <span>{name}</span>
                      <span className="metric-number text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {muscleGroups.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Músculos</h3>
                <div className="space-y-2 text-sm">
                  {muscleGroups.map(([name, sets]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <span>{name}</span>
                      <span className="metric-number text-muted-foreground">{sets} {sets === 1 ? "serie" : "series"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasPreviousWeek && previousWeek && (
              <div className="space-y-2.5 border-t border-border/70 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comparación semanal</h3>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-right text-xs">
                  <span className="text-left text-muted-foreground">&nbsp;</span><span className="text-muted-foreground">Esta</span><span className="text-muted-foreground">Anterior</span>
                  <span className="text-left">Entrenamientos</span><span className="metric-number font-medium">{currentWeek?.sessions ?? 0} <span className="text-primary">{comparisonLabel(currentWeek?.sessions ?? 0, previousWeek.sessions)}</span></span><span className="metric-number text-muted-foreground">{previousWeek.sessions}</span>
                  <span className="text-left">Series</span><span className="metric-number font-medium">{currentWeek?.sets ?? 0} <span className="text-primary">{comparisonLabel(currentWeek?.sets ?? 0, previousWeek.sets)}</span></span><span className="metric-number text-muted-foreground">{previousWeek.sets}</span>
                  <span className="text-left">Duración</span><span className="metric-number font-medium">{formatTrainingMinutes(currentWeek?.minutes ?? 0)}</span><span className="metric-number text-muted-foreground">{formatTrainingMinutes(previousWeek.minutes)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

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

      <div className="hidden space-y-6 lg:block">
        <section className="grid grid-cols-4 gap-4" aria-label="Resumen de esta semana">
          {[
            { label: "Entrenamientos", value: String(currentWeek?.sessions ?? 0), icon: Dumbbell },
            { label: "Series", value: String(currentWeek?.sets ?? 0), icon: ListChecks },
            { label: "Duración", value: formatTrainingMinutes(currentWeek?.minutes ?? 0), icon: Clock3 },
            { label: "Volumen", value: `${rounded(currentWeek?.volumeKg ?? 0)} kg`, icon: Activity },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} size="sm">
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="metric-number mt-1 text-2xl font-semibold tracking-tight">{value}</p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-12 gap-5" aria-label="Reporte semanal detallado">
          <Card className="col-span-8">
            <CardContent className="pt-5">
              <div className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight">Evolución semanal</h2>
                <p className="text-sm text-muted-foreground">Volumen acumulado de las últimas ocho semanas.</p>
              </div>
              <WeeklyVolumeChart weeks={progress.weeks} />
            </CardContent>
          </Card>

          <Card id="desktop-weekly-report" className="col-span-4 scroll-mt-6">
            <CardContent className="space-y-5 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {currentWeek ? `Semana ${formatWeekRange(currentWeek)}` : "Esta semana"}
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Distribución del trabajo</h2>
              </div>
              <MuscleDistribution values={currentWeek?.muscleGroups ?? {}} limit={7} />
              {routines.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rutinas</p>
                  {routines.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{name}</span>
                      <span className="metric-number text-muted-foreground">×{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {hasPreviousWeek && previousWeek && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contra la semana anterior</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Entrenamientos</span>
                    <span className="metric-number text-right font-medium">{comparisonLabel(currentWeek?.sessions ?? 0, previousWeek.sessions)}</span>
                    <span className="text-muted-foreground">Series</span>
                    <span className="metric-number text-right font-medium">{comparisonLabel(currentWeek?.sets ?? 0, previousWeek.sets)}</span>
                    <span className="text-muted-foreground">Duración anterior</span>
                    <span className="metric-number text-right font-medium">{formatTrainingMinutes(previousWeek.minutes)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" aria-labelledby="exercise-progress-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="exercise-progress-title" className="text-lg font-semibold tracking-tight">Progreso por ejercicio</h2>
              <p className="text-sm text-muted-foreground">Último registro, mejor carga y volumen histórico.</p>
            </div>
            <span className="text-xs text-muted-foreground">{progress.exercises.length} ejercicios con historial</span>
          </div>
          {progress.exercises.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Finalizá una sesión para empezar a ver progreso.</CardContent></Card>
          ) : (
            <Card className="gap-0 py-0">
              <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_110px_100px_120px_88px] gap-4 border-b bg-muted/35 px-5 py-3 text-xs font-semibold text-muted-foreground">
                <span>Ejercicio</span><span>Grupo</span><span>Última vez</span><span className="text-right">Mejor kg</span><span className="text-right">Volumen</span><span />
              </div>
              <div className="divide-y">
                {progress.exercises.map((exercise) => (
                  <div key={exercise.exerciseId} className="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_110px_100px_120px_88px] items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-muted/25">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{exercise.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{exercise.sessions} {exercise.sessions === 1 ? "sesión" : "sesiones"} · {ADJUSTMENT_LABELS[exercise.lastDecision]}</p>
                    </div>
                    <span className="truncate text-muted-foreground">{exercise.muscleGroup ?? "Sin grupo"}</span>
                    <span className="metric-number text-muted-foreground">{exercise.lastDate}</span>
                    <span className="metric-number text-right font-medium">{exercise.bestWeightKg ?? "—"}</span>
                    <span className="metric-number text-right font-medium">{rounded(exercise.totalVolumeKg)} kg</span>
                    <Link href={`/train/history/${exercise.exerciseId}`} className="text-right text-sm font-medium text-primary hover:underline">Ver</Link>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
