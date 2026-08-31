import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    <div className="space-y-5">
      {notice === "discarded" ? <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Sesión eliminada del historial.</p> : null}
      <section className="space-y-2" aria-labelledby="continuity-title">
        <div className="px-1">
          <h2 id="continuity-title" className="text-base font-semibold tracking-tight">Continuidad</h2>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y divide-border/70">
            {latest ? (
              <Link
                href={`/train/session/${latest.id}`}
                className="group flex min-h-12 items-center gap-3 px-3 py-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">Última</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">
                    {latest.routineName} <span className="font-normal text-muted-foreground">· {formatRelativeTrainingDays(daysBetweenIsoDates(latest.logDate, currentDate))}</span>
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ) : (
              <p className="px-3 py-3 text-sm text-muted-foreground">Sin sesiones completadas.</p>
            )}
            {continuity.map((item) => (
              <Link
                key={item.routineId}
                href={`/train/routines/${item.routineId}`}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="truncate font-medium">{item.routineName}</span>
                <span className="metric-number shrink-0 text-xs text-muted-foreground">{formatRelativeTrainingDays(item.daysSince)}</span>
              </Link>
            ))}
          </div>
          {continuity.length === 0 ? <p className="border-t border-border/70 px-3 py-2.5 text-sm text-muted-foreground">Todavía no hay rutinas activas para comparar.</p> : null}
          {leastRecent ? <p className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">Más tiempo sin hacer · <span className="font-medium text-foreground">{leastRecent.routineName}</span> · {formatRelativeTrainingDays(leastRecent.daysSince)}</p> : null}
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="recent-sessions-title">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="recent-sessions-title" className="text-base font-semibold tracking-tight">Sesiones recientes</h2>
          <p className="text-xs text-muted-foreground">Finalizadas</p>
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Cuando finalices un entrenamiento, va a aparecer acá.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {sessions.map((session) => {
              const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
              const duration = formatWorkoutDuration(session.durationMilliseconds);
              return <Link key={session.id} href={`/train/session/${session.id}`} className="group flex min-h-[68px] items-center gap-3 border-b border-border/70 px-3 py-2.5 outline-none transition-[background-color,transform] duration-150 last:border-b-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.995]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{session.routineName}</p>
                    <p className="metric-number mt-0.5 truncate text-xs text-muted-foreground">{formatSessionDate(session.logDate)}{range ? ` · ${range}` : ""}</p>
                    <p className="metric-number mt-0.5 truncate text-xs text-muted-foreground">
                      {[duration, plural(session.exercisesCompleted, "ejercicio"), plural(session.completedSets, "serie")].filter(Boolean).join(" · ")}
                      {session.routineId === null && session.muscleGroups.length > 0 ? ` · ${session.muscleGroups.slice(0, 2).join(" · ")}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
              </Link>;
            })}
          </div>
        )}
        {hasMore ? <Link href={`/train/history?view=sessions&limit=${Math.min(currentLimit + 20, 100)}`} className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline">Ver más sesiones</Link> : null}
      </section>
    </div>
  );
}
