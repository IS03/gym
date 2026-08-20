import { Card, CardContent } from "@/components/ui/card";
import { ExerciseDirectory } from "@/components/training/exercise-directory";
import { WeeklyTrainingChart, WeeklyTrainingDistribution } from "@/components/training/training-insights";
import { formatTrainingMinutes } from "@/lib/phase2/training-progress-summary";
import { getTrainingProgress } from "@/lib/phase2/training-robust";
import { listExerciseRoutineMemberships, listExercises, listRoutines } from "@/lib/phase2/training";
import type { WeeklyTrainingSummary } from "@/lib/phase2/types";

export const dynamic = "force-dynamic";

function formatWeekRange(week: WeeklyTrainingSummary) {
  const formatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" });
  const start = formatter.format(new Date(`${week.weekStart}T12:00:00Z`)).replace(".", "");
  const end = formatter.format(new Date(`${week.weekEnd}T12:00:00Z`)).replace(".", "");
  return `${start} – ${end}`;
}

function formatVolume(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)} kg`;
}

function comparisonDelta(current: number, previous: number, unit: "count" | "minutes" | "volume") {
  const difference = current - previous;
  if (difference === 0) return "sin cambios";
  if (unit === "minutes") return `${difference > 0 ? "+" : "−"}${formatTrainingMinutes(Math.abs(difference))}`;
  if (unit === "volume") {
    if (previous <= 0) return "sin referencia";
    const percentage = Math.round((Math.abs(difference) / previous) * 100);
    return `${difference > 0 ? "↑" : "↓"} ${percentage}%`;
  }
  return `${difference > 0 ? "↑" : "↓"} ${Math.abs(difference)}`;
}

export default async function TrainingProgressPage() {
  const [progress, activeRoutines, exercises] = await Promise.all([
    getTrainingProgress(),
    listRoutines({ includeArchived: false }),
    listExercises({ includeArchived: false }),
  ]);
  const memberships = await listExerciseRoutineMemberships(activeRoutines.map((routine) => routine.id));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const exerciseDirectoryItems = progress.exercises.map((exercise) => ({
    id: exercise.exerciseId,
    name: exercise.name,
    muscleGroup: exerciseById.get(exercise.exerciseId)?.grupo_muscular ?? null,
    muscleLabel: exercise.muscleGroup ?? exerciseById.get(exercise.exerciseId)?.muscle_group_label ?? null,
    lastDate: exercise.lastDate,
    sessions: exercise.sessions,
    bestWeightKg: exercise.bestWeightKg,
    totalVolumeKg: exercise.totalVolumeKg,
    lastDecision: exercise.lastDecision,
    lastSets: exercise.lastSets,
    routineIds: (memberships.get(exercise.exerciseId) ?? []).map((membership) => membership.id),
  }));
  const currentWeek = progress.weeks[0];
  const previousWeek = progress.weeks[1];
  const hasTrainingThisWeek = Boolean(currentWeek && currentWeek.sessions > 0);
  const hasPreviousWeek = Boolean(previousWeek && previousWeek.sessions > 0 && currentWeek);

  return (
    <div className="space-y-6 lg:mx-auto lg:max-w-6xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso de entrenamiento</h1>
        <p className="text-sm text-muted-foreground">Sesiones finalizadas y series realizadas.</p>
      </div>

      <section className="space-y-3" aria-labelledby="this-week-title">
        <Card className="surface-elevated">
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-1">
              <h2 id="this-week-title" className="text-lg font-semibold tracking-tight">Esta semana</h2>
              <p className="text-sm text-muted-foreground">{currentWeek ? formatWeekRange(currentWeek) : "Semana actual"}</p>
            </div>
            {!hasTrainingThisWeek ? (
              <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">Todavía no registraste entrenamientos finalizados.</p>
            ) : (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4" aria-label="Resumen semanal">
                {[
                  { label: "Entrenamientos", value: String(currentWeek.sessions) },
                  { label: "Series", value: String(currentWeek.sets) },
                  { label: "Duración", value: formatTrainingMinutes(currentWeek.minutes) },
                  { label: "Volumen", value: formatVolume(currentWeek.volumeKg) },
                ].map((metric) => (
                  <div key={metric.label} className="bg-card px-3 py-3 text-center sm:px-4">
                    <p className="metric-number text-lg font-semibold tracking-tight sm:text-xl">{metric.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.label}</p>
                  </div>
                ))}
              </div>
            )}
            {hasPreviousWeek && previousWeek && currentWeek && (
              <div className="space-y-2 border-t border-border/70 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vs. semana anterior</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  {[
                    { label: "Entrenamientos", value: String(currentWeek.sessions), delta: comparisonDelta(currentWeek.sessions, previousWeek.sessions, "count") },
                    { label: "Series", value: String(currentWeek.sets), delta: comparisonDelta(currentWeek.sets, previousWeek.sets, "count") },
                    { label: "Duración", value: formatTrainingMinutes(currentWeek.minutes), delta: comparisonDelta(currentWeek.minutes, previousWeek.minutes, "minutes") },
                    { label: "Volumen", value: formatVolume(currentWeek.volumeKg), delta: comparisonDelta(currentWeek.volumeKg, previousWeek.volumeKg, "volume") },
                  ].map((metric) => <div key={metric.label}><p className="text-xs text-muted-foreground">{metric.label}</p><p className="metric-number mt-0.5 font-medium">{metric.value} <span className="text-primary">{metric.delta}</span></p></div>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {hasTrainingThisWeek && currentWeek && (
        <section aria-label="Distribución semanal">
          <Card className="surface-elevated"><CardContent className="pt-5"><WeeklyTrainingDistribution muscles={currentWeek.muscleGroups} routines={currentWeek.routines} /></CardContent></Card>
        </section>
      )}

      <section aria-label="Evolución semanal">
        <Card className="surface-elevated"><CardContent className="pt-5"><WeeklyTrainingChart weeks={progress.weeks} /></CardContent></Card>
      </section>

      <section className="space-y-3" aria-labelledby="exercise-progress-title">
        <div>
          <h2 id="exercise-progress-title" className="text-lg font-semibold tracking-tight">Progreso por ejercicio</h2>
          <p className="text-sm text-muted-foreground">Último registro, mejor peso y decisión para la próxima sesión.</p>
        </div>
        <ExerciseDirectory items={exerciseDirectoryItems} routines={activeRoutines.map((routine) => ({ id: routine.id, nombre: routine.nombre }))} mode="progress" />
      </section>
    </div>
  );
}
