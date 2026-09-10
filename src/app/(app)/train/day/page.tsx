import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { trainingDayReturnTarget } from "@/lib/phase2/training-calendar";
import { formatTrainingDayHeading } from "@/lib/phase2/session-history";
import {
  listCompletedSessionHistory,
  todayInCordoba,
} from "@/lib/phase2/training-robust";
import {
  formatTrainingDayVolume,
  orderTrainingDaySessions,
  summarizeTrainingDay,
} from "@/lib/phase2/training-day-summary";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import type { CompletedSessionSummary } from "@/lib/phase2/types";
import {
  formatWorkoutDuration,
  formatWorkoutTimeRange,
} from "../session/[id]/session-editor-helpers";

export const dynamic = "force-dynamic";

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function DayStat({
  value,
  label,
  divided,
}: {
  value: string | null;
  label: string;
  divided?: "left" | "top-left" | "top";
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-4 py-3.5",
        divided === "left" && "border-l border-border/70",
        divided === "top" && "border-t border-border/70",
        divided === "top-left" && "border-l border-t border-border/70",
      )}
    >
      <span className="metric-number block truncate text-lg font-semibold tracking-tight text-foreground">
        {value ?? "—"}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function SessionIdentity({
  color,
}: {
  color: CompletedSessionSummary["routineColor"];
}) {
  return (
    <span
      className="h-12 w-1 shrink-0 rounded-full"
      style={{ backgroundColor: routineColorCssVariable(color) }}
      aria-hidden
    />
  );
}

function SessionRow({
  session,
  divided,
}: {
  session: CompletedSessionSummary;
  divided: boolean;
}) {
  const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
  const duration = formatWorkoutDuration(session.durationMilliseconds);
  const volume = formatTrainingDayVolume(session.volumeKg);

  return (
    <Link
      href={`/train/session/${session.id}`}
      className={cn(
        "group flex min-h-[88px] items-center gap-3 px-3.5 py-3 outline-none transition-[background-color,transform] duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/60",
        divided && "border-t border-border/70",
      )}
    >
      <SessionIdentity color={session.routineColor} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold tracking-tight">
          {session.routineName}
        </span>
        <span className="metric-number mt-0.5 block truncate text-xs text-muted-foreground">
          {[range, duration].filter(Boolean).join(" · ") || "Sesión terminada"}
        </span>
        <span className="metric-number mt-0.5 block truncate text-xs text-muted-foreground">
          {plural(session.exercisesCompleted, "ejercicio")} ·{" "}
          {plural(session.completedSets, "serie")}
          {volume ? ` · ${volume}` : " · Volumen sin registrar"}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export default async function TrainDayPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const date = typeof sp.date === "string" ? sp.date : todayInCordoba();
  const routineId = typeof sp.routine_id === "string" ? sp.routine_id : "";
  const source = typeof sp.from === "string" ? sp.from : undefined;
  const allSessions = await listCompletedSessionHistory({
    logDate: date,
    limit: 100,
  });
  const sessions = orderTrainingDaySessions(
    routineId
      ? allSessions.filter((session) => session.routineId === routineId)
      : allSessions,
  );
  const summary = summarizeTrainingDay(sessions);
  const returnTarget = trainingDayReturnTarget(date, routineId || null, source);

  return (
    <div className="space-y-5 lg:mx-auto lg:max-w-5xl">
      <header className="space-y-2">
        <Link
          href={returnTarget.href}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {returnTarget.label}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          {formatTrainingDayHeading(date)}
        </h1>
      </header>

      {sessions.length === 0 ? (
        <section className="rounded-xl border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No hay entrenamientos terminados este día.
          </p>
          <Link
            href={returnTarget.href}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Volver a {returnTarget.label.toLocaleLowerCase("es-AR")}
          </Link>
        </section>
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="day-summary-title">
            <h2 id="day-summary-title" className="mb-2 text-sm font-semibold">
              Resumen del día
            </h2>
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <div className="px-4 py-4">
                <p className="metric-number text-2xl font-semibold tracking-tight">
                  {plural(summary.sessionCount, "entrenamiento")}
                </p>
              </div>
              <div className="grid grid-cols-2 border-t border-border/70">
                <DayStat
                  value={formatWorkoutDuration(summary.durationMilliseconds)}
                  label="duración total"
                />
                <DayStat
                  value={String(summary.exercisesCompleted)}
                  label="ejercicios"
                  divided="left"
                />
                <DayStat
                  value={String(summary.completedSets)}
                  label="series"
                  divided="top"
                />
                <DayStat
                  value={formatTrainingDayVolume(summary.volumeKg)}
                  label="volumen total"
                  divided="top-left"
                />
              </div>
            </div>
          </section>
          <section aria-labelledby="day-sessions-title">
            <h2 id="day-sessions-title" className="mb-2 text-sm font-semibold">
              Sesiones del día
            </h2>
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
              {sessions.map((session, index) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  divided={index > 0}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
