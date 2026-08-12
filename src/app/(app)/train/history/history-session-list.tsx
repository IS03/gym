import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { daysBetweenIsoDates, formatRelativeTrainingDays, formatSessionDate, leastRecentRoutine } from "@/lib/phase2/session-history";
import { formatWorkoutDuration, formatWorkoutTimeRange } from "../session/[id]/session-editor-helpers";
import type { CompletedSessionSummary, RoutineContinuity } from "@/lib/phase2/types";

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export function HistorySessionList({
  sessions,
  continuity,
  hasMore,
  currentLimit,
  currentDate,
  notice,
}: {
  sessions: CompletedSessionSummary[];
  continuity: RoutineContinuity[];
  hasMore: boolean;
  currentLimit: number;
  currentDate: string;
  notice: string | null;
}) {
  const latest = sessions[0] ?? null;
  const leastRecent = leastRecentRoutine(continuity);

  return (
    <div className="space-y-6">
      {notice === "discarded" ? <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Sesión eliminada del historial.</p> : null}
      <section className="space-y-3" aria-labelledby="continuity-title">
        <div>
          <h2 id="continuity-title" className="text-base font-semibold tracking-tight">Continuidad</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tus últimos registros por rutina activa.</p>
        </div>
        <Card className="surface-elevated">
          <CardContent className="space-y-4 pt-4">
            <div className="border-b border-border/70 pb-3">
              <p className="text-xs text-muted-foreground">Última sesión</p>
              {latest ? (
                <Link href={`/train/session/${latest.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold hover:text-primary">
                  {latest.routineName} · {formatRelativeTrainingDays(daysBetweenIsoDates(latest.logDate, currentDate))}
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              ) : <p className="mt-1 text-sm text-muted-foreground">Sin sesiones completadas.</p>}
            </div>
            {continuity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay rutinas activas para comparar.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {continuity.map((item) => (
                  <Link key={item.routineId} href={`/train/routines/${item.routineId}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/70">
                    <span className="truncate font-medium">{item.routineName}</span>
                    <span className="metric-number shrink-0 text-xs text-muted-foreground">{formatRelativeTrainingDays(item.daysSince)}</span>
                  </Link>
                ))}
              </div>
            )}
            {leastRecent ? <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">Más tiempo sin hacer: <span className="font-medium text-foreground">{leastRecent.routineName}</span> · {formatRelativeTrainingDays(leastRecent.daysSince)}</p> : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="recent-sessions-title">
        <div>
          <h2 id="recent-sessions-title" className="text-base font-semibold tracking-tight">Sesiones recientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sólo entrenamientos finalizados.</p>
        </div>
        {sessions.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cuando finalices un entrenamiento, va a aparecer acá.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
              const duration = formatWorkoutDuration(session.durationMilliseconds);
              return <Link key={session.id} href={`/train/session/${session.id}`} className="group block rounded-xl bg-card shadow-sm ring-1 ring-foreground/8 outline-none transition-[background-color,transform,box-shadow] duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
                <div className="flex min-h-[88px] items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{session.routineName}</p></div>
                    <p className="metric-number mt-1 text-xs text-muted-foreground">{formatSessionDate(session.logDate)}{range ? ` · ${range}` : ""}</p>
                    <p className="metric-number mt-1 text-xs text-muted-foreground">{[duration, plural(session.exercisesCompleted, "ejercicio"), plural(session.completedSets, "serie")].filter(Boolean).join(" · ")}</p>
                    {session.muscleGroups.length > 0 ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{session.muscleGroups.join(" · ")}</p> : null}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </div>
              </Link>;
            })}
          </div>
        )}
        {hasMore ? <Link href={`/train/history?view=sessions&limit=${Math.min(currentLimit + 20, 100)}`} className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline">Ver más sesiones</Link> : null}
      </section>
    </div>
  );
}
