import Link from "next/link";
import { CalendarClock, ChevronRight, Clock3 } from "lucide-react";
import {
  daysBetweenIsoDates,
  formatCompactRelativeTrainingDays,
  formatTrainingDayHeading,
  leastRecentRoutine,
} from "@/lib/phase2/session-history";
import { groupCompletedSessionsByDate } from "@/lib/phase2/training-history";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import { formatWorkoutDuration, formatWorkoutTimeRange } from "../session/[id]/session-editor-helpers";
import type { CompletedSessionSummary, RoutineContinuity } from "@/lib/phase2/types";

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export function HistorySessionList({ sessions, continuity, hasMore, currentLimit, currentDate, notice }: {
  sessions: CompletedSessionSummary[];
  continuity: RoutineContinuity[];
  hasMore: boolean;
  currentLimit: number;
  currentDate: string;
  notice: string | null;
}) {
  const latest = sessions[0] ?? null;
  const leastRecent = leastRecentRoutine(continuity);
  const groups = groupCompletedSessionsByDate(sessions);

  return (
    <div className="space-y-5">
      {notice === "discarded" ? <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Sesión eliminada del historial.</p> : null}

      {(latest || leastRecent) ? (
        <section className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card" aria-label="Resumen de continuidad">
          {latest ? (
            <Link href={`/train/session/${latest.id}`} className="group flex min-h-[72px] min-w-0 items-center gap-2.5 px-3 py-2.5 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Clock3 className="size-4" aria-hidden /></span>
              <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">Última</span><span className="mt-0.5 block truncate text-sm font-semibold">{latest.routineName} · {formatCompactRelativeTrainingDays(daysBetweenIsoDates(latest.logDate, currentDate))}</span></span>
            </Link>
          ) : <span />}
          {leastRecent ? (
            <Link href={`/train/routines/${leastRecent.routineId}`} className="group flex min-h-[72px] min-w-0 items-center gap-2.5 border-l px-3 py-2.5 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><CalendarClock className="size-4" aria-hidden /></span>
              <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">Más atrasada</span><span className="mt-0.5 block truncate text-sm font-semibold">{leastRecent.routineName} · {formatCompactRelativeTrainingDays(leastRecent.daysSince)}</span></span>
            </Link>
          ) : <span />}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="recent-sessions-title">
        <h2 id="recent-sessions-title" className="px-1 text-lg font-semibold tracking-tight">Sesiones recientes</h2>
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Cuando finalices un entrenamiento, va a aparecer acá.</div>
        ) : groups.map((group) => (
          <section key={group.date} className="space-y-1.5" aria-labelledby={`history-day-${group.date}`}>
            <h3 id={`history-day-${group.date}`} className="px-1 text-sm font-medium text-muted-foreground">{formatTrainingDayHeading(group.date)}</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              {group.sessions.map((session) => {
                const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
                const duration = formatWorkoutDuration(session.durationMilliseconds);
                return (
                  <Link key={session.id} href={`/train/session/${session.id}`} className="group relative flex min-h-[76px] items-center gap-3 border-b border-border/70 px-3 py-2.5 pl-4 outline-none transition-[background-color,transform] duration-150 last:border-b-0 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.995]">
                    <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: routineColorCssVariable(session.routineColor) }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{session.routineName}</span>
                      {range ? <span className="metric-number mt-0.5 block text-xs text-muted-foreground">{range}</span> : null}
                      <span className="metric-number mt-1 block truncate text-xs text-muted-foreground">{[duration, plural(session.exercisesCompleted, "ejercicio"), plural(session.completedSets, "serie")].filter(Boolean).join(" · ")}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {hasMore ? <Link href={`/train/history?view=sessions&limit=${Math.min(currentLimit + 20, 100)}`} className="inline-flex h-11 items-center text-sm font-medium text-primary hover:underline">Ver más sesiones</Link> : null}
      </section>
    </div>
  );
}
