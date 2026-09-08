"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, History, X } from "lucide-react";
import type { ExerciseReportSession } from "@/lib/phase2/exercise-insights";
import { formatSessionDate } from "@/lib/phase2/session-history";
import {
  quickHistoryCompletedSets,
  quickHistorySetLabel,
  quickHistoryUniformLoadDetails,
  quickHistoryUniformLoadSummary,
  splitQuickExerciseHistory,
} from "@/lib/phase2/quick-exercise-history";

type QuickExerciseHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
  exerciseName: string;
  sessions: readonly ExerciseReportSession[];
};

function HistorySets({ session }: { session: ExerciseReportSession }) {
  const completedSets = quickHistoryCompletedSets(session);
  const uniformSummary = quickHistoryUniformLoadSummary(session);
  const uniformDetails = quickHistoryUniformLoadDetails(session);

  if (completedSets.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No hay series completadas.</p>;
  }

  if (uniformSummary) {
    return (
      <div className="mt-2">
        <p className="metric-number text-sm font-medium">{uniformSummary}</p>
        {uniformDetails?.rir ? (
          <p className="metric-number mt-0.5 text-xs text-muted-foreground">
            RIR {uniformDetails.rir}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {completedSets.map((set) => (
        <li key={set.id} className="flex items-baseline gap-2 text-sm">
          <span className="metric-number shrink-0 text-xs font-semibold text-muted-foreground">
            S{set.set_number}
          </span>
          <span className="metric-number min-w-0 font-medium">{quickHistorySetLabel(set)}</span>
          {set.target_rir !== null ? (
            <span className="metric-number shrink-0 text-xs text-muted-foreground">
              RIR {set.target_rir}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function LatestMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-primary/15 px-2 first:pl-0 last:border-r-0 last:pr-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="metric-number mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function LatestSessionSummary({ session }: { session: ExerciseReportSession }) {
  const details = quickHistoryUniformLoadDetails(session);

  if (!details) return <HistorySets session={session} />;

  return (
    <div className="mt-3 grid grid-cols-3 rounded-xl border border-primary/15 bg-background/45 px-3 py-2.5">
      <LatestMetric label="Peso" value={details.weight} />
      <LatestMetric label="Reps" value={details.reps} />
      <LatestMetric label="RIR" value={details.rir ?? "—"} />
    </div>
  );
}

function PreviousHistoryEntry({ session }: { session: ExerciseReportSession }) {
  return (
    <Dialog.Close
      render={
        <Link
          href={`/train/session/${session.sessionId}`}
          className="group flex min-h-16 items-center gap-3 py-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
        />
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">{formatSessionDate(session.logDate)}</span>
          <span className="truncate text-xs text-muted-foreground">{session.routineName}</span>
        </div>
        <HistorySets session={session} />
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Dialog.Close>
  );
}

export function QuickExerciseHistorySheet({
  open,
  onOpenChange,
  exerciseId,
  exerciseName,
  sessions,
}: QuickExerciseHistorySheetProps) {
  const { latest, previous } = splitQuickExerciseHistory(sessions);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[61] flex items-end justify-center overflow-hidden px-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(78svh,42rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.7rem] border border-border bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:max-h-[min(78dvh,42rem)] lg:rounded-[1.7rem] lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <div className="shrink-0 border-b border-border/70 px-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" />
              <div className="flex min-h-12 items-center gap-3 pb-3">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-lg font-semibold tracking-tight">
                    Últimas veces
                  </Dialog.Title>
                  <Dialog.Description className="truncate text-xs text-muted-foreground">
                    {exerciseName}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  type="button"
                  aria-label="Cerrar últimas veces"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
              {!latest ? (
                <div className="flex min-h-44 items-center justify-center px-5 text-center">
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay sesiones finalizadas con este ejercicio.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-3 py-3">
                    <p className="text-xs font-medium text-primary">Última sesión</p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold">{formatSessionDate(latest.logDate)}</p>
                      <p className="truncate text-xs text-muted-foreground">{latest.routineName}</p>
                    </div>
                    <LatestSessionSummary session={latest} />
                  </section>

                  {previous.length > 0 ? (
                    <section aria-label="Sesiones anteriores">
                      <div className="mb-1 flex items-center gap-2">
                        <History className="size-4 text-primary" aria-hidden />
                        <h3 className="text-sm font-semibold">Historial</h3>
                      </div>
                      <ul className="divide-y divide-border/70">
                        {previous.map((session) => (
                          <li key={session.sessionId} className="first:pt-0 last:pb-0">
                            <PreviousHistoryEntry session={session} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              )}
            </div>

            {latest ? (
              <div className="shrink-0 border-t border-border/70 bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                <Dialog.Close
                  render={
                    <Link
                      href={`/train/history/${exerciseId}?from=history`}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/35 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  }
                >
                  <History className="size-4" aria-hidden />
                  Ver más historial
                  <ChevronRight className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
