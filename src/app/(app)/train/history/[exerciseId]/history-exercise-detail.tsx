import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Dumbbell, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import {
  buildTrainingHistoryExerciseDetail,
  formatTrainingHistoryMark,
} from "@/lib/phase2/training-history";
import type { ExerciseReportSession } from "@/lib/phase2/exercise-insights";
import type { MuscleGroup } from "@/lib/phase2/types";
import { cn } from "@/lib/utils";

const CORDOBA_TIME_ZONE = "America/Argentina/Cordoba";

function date(value: string, short = false) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: CORDOBA_TIME_ZONE,
  }).format(new Date(value + "T12:00:00Z")).replace(".", "");
}

function rirLabel(values: number[]) {
  return values.length > 0 ? "RIR " + values.join(" / ") : null;
}

function markMetadata(completedSets: number, rirValues: number[]) {
  return [
    completedSets + " " + (completedSets === 1 ? "serie" : "series"),
    rirLabel(rirValues),
  ].filter(Boolean).join(" · ");
}

function Highlight({
  title,
  item,
  record = false,
}: {
  title: string;
  item: ReturnType<typeof buildTrainingHistoryExerciseDetail>["latest"];
  record?: boolean;
}) {
  const headingId = record ? "history-best-title" : "history-latest-title";
  return (
    <section className="space-y-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="px-1 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex min-h-[112px] items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", record ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {record ? <Trophy className="size-5" aria-hidden /> : <CalendarDays className="size-5" aria-hidden />}
        </span>
        {item ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground">{date(item.logDate)}</p>
              {record ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">Récord</span> : null}
            </div>
            <p className="metric-number mt-1 truncate text-xl font-semibold tracking-tight">{formatTrainingHistoryMark(item.mark)}</p>
            <p className="metric-number mt-1 truncate text-xs text-muted-foreground">{markMetadata(item.completedSets, item.rirValues)}</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">Todavía no hay una marca comparable.</p>}
      </div>
    </section>
  );
}

export function HistoryExerciseDetail({
  exerciseId,
  exerciseName,
  muscleGroup,
  muscleLabel,
  implement,
  weightMode,
  sessions,
  currentLimit,
  returnHref,
}: {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup | null;
  muscleLabel: string | null;
  implement: string | null;
  weightMode: string | null;
  sessions: ExerciseReportSession[];
  currentLimit: number;
  returnHref: string;
}) {
  const detail = buildTrainingHistoryExerciseDetail(sessions);
  const visibleSessions = detail.sessions.slice(0, currentLimit);
  const hasMore = detail.sessions.length > currentLimit;
  const progressHref = "/train/history/" + exerciseId + "?from=progress&view=exercises&period=3m";
  const metadata = exerciseIdentityLabel({
    grupo_muscular: muscleGroup,
    muscle_group_label: muscleLabel,
    implement,
    weight_mode: weightMode,
  });

  return (
    <div className="space-y-6 pb-2 lg:mx-auto lg:max-w-3xl">
      <header className="space-y-4">
        <Link href={returnHref} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4" aria-hidden /> Ejercicios
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight lg:text-3xl">{exerciseName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{metadata}</p>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Dumbbell className="size-5" aria-hidden /></span>
        </div>
      </header>

      <Highlight title="Última vez" item={detail.latest} />
      <Highlight title="Mejor marca" item={detail.best} record={Boolean(detail.best)} />

      <section className="space-y-2" aria-labelledby="exercise-history-sessions-title">
        <h2 id="exercise-history-sessions-title" className="px-1 text-lg font-semibold tracking-tight">Sesiones</h2>
        {visibleSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Este ejercicio todavía no tiene registros históricos.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {visibleSessions.map((session) => (
              <Link key={session.sessionId} href={"/train/session/" + session.sessionId} className="group flex min-h-[72px] items-center gap-3 border-b border-border/70 px-3 py-2.5 outline-none transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><CalendarDays className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{date(session.logDate, true)} · {session.routineName}</span>
                  <span className="metric-number mt-0.5 block truncate text-sm font-semibold">{formatTrainingHistoryMark(session.mark)}</span>
                  <span className="metric-number mt-0.5 block truncate text-xs text-muted-foreground">{markMetadata(session.completedSets, session.rirValues)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        )}
        {hasMore ? (
          <Button variant="link" className="h-10 px-1" render={<Link href={"/train/history/" + exerciseId + "?from=history&return=" + encodeURIComponent(returnHref) + "&limit=" + Math.min(currentLimit + 20, 100)} />}>Ver más</Button>
        ) : null}
      </section>

      <Link href={progressHref} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 text-sm font-semibold text-primary outline-none transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring">
        Ver análisis en Progreso <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
