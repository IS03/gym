import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trainingCalendarHref } from "@/lib/phase2/training-calendar";
import { formatTrainingDayHeading } from "@/lib/phase2/session-history";
import {
  listCompletedSessionHistory,
  todayInCordoba,
} from "@/lib/phase2/training-robust";
import {
  orderTrainingDaySessions,
  summarizeTrainingDay,
} from "@/lib/phase2/training-day-summary";
import {
  formatWorkoutDuration,
  formatWorkoutTimeRange,
} from "../session/[id]/session-editor-helpers";

export const dynamic = "force-dynamic";

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

export default async function TrainDayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const date = typeof sp.date === "string" ? sp.date : todayInCordoba();
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";
  const allSessions = await listCompletedSessionHistory({ logDate: date, limit: 100 });
  const sessions = orderTrainingDaySessions(
    routineId ? allSessions.filter((session) => session.routineId === routineId) : allSessions,
  );
  const summary = summarizeTrainingDay(sessions);
  const calendarHref = trainingCalendarHref(date.slice(0, 7) as `${number}-${number}`, routineId || null);
  const summaryParts = [
    summary.sessionCount > 1 ? plural(summary.sessionCount, "entrenamiento") : null,
    plural(summary.exercisesCompleted, "ejercicio"),
    plural(summary.completedSets, "serie"),
    formatWorkoutDuration(summary.durationMilliseconds),
  ].filter(Boolean);

  return (
    <div className="space-y-5 lg:mx-auto lg:max-w-5xl">
      <header className="space-y-2">
        <Link
          href={calendarHref}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Calendario
        </Link>
        <div className="space-y-1">
          <h1 className="capitalize text-2xl font-semibold tracking-tight lg:text-3xl">
            {formatTrainingDayHeading(date)}
          </h1>
          {sessions.length > 0 ? (
            <p className="metric-number text-sm text-muted-foreground">
              {summaryParts.join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sesiones terminadas.</p>
          )}
        </div>
      </header>

      {sessions.length === 0 ? (
        <section className="rounded-xl border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay entrenamientos terminados este día.
          </p>
          <Link
            href={calendarHref}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Volver al calendario
          </Link>
        </section>
      ) : (
        <section aria-labelledby="day-sessions-title">
          <h2 id="day-sessions-title" className="sr-only">Sesiones terminadas</h2>
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            {sessions.map((session, index) => {
              const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
              const duration = formatWorkoutDuration(session.durationMilliseconds);

              return (
                <Link
                  key={session.id}
                  href={`/train/session/${session.id}`}
                  className={cn(
                    "group flex min-h-[76px] items-center gap-3 px-3.5 py-3 outline-none transition-[background-color,transform] duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/60",
                    index > 0 && "border-t border-border/70",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {session.routineName}
                    </span>
                    <span className="metric-number mt-0.5 block truncate text-xs text-muted-foreground">
                      {[range, duration].filter(Boolean).join(" · ") || "Sesión terminada"}
                    </span>
                    <span className="metric-number mt-0.5 block truncate text-xs text-muted-foreground">
                      {plural(session.exercisesCompleted, "ejercicio")} · {plural(session.completedSets, "serie")}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
