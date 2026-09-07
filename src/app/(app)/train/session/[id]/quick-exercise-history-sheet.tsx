"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ExerciseReportSession } from "@/lib/phase2/exercise-insights";
import { formatSessionDate } from "@/lib/phase2/session-history";
import {
  quickHistoryCompletedSets,
  quickHistoryLatestSummary,
  quickHistorySetLabel,
  recentExerciseHistorySessions,
} from "@/lib/phase2/quick-exercise-history";

type QuickExerciseHistorySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  sessions: readonly ExerciseReportSession[];
};

export function QuickExerciseHistorySheet({
  open,
  onOpenChange,
  exerciseName,
  sessions,
}: QuickExerciseHistorySheetProps) {
  const recentSessions = recentExerciseHistorySessions(sessions);
  const latestSummary = quickHistoryLatestSummary(recentSessions[0] ?? null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[61] flex items-end justify-center overflow-hidden px-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(76svh,38rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.7rem] border border-border bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:max-h-[min(76dvh,38rem)] lg:rounded-[1.7rem] lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
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
              {recentSessions.length === 0 ? (
                <div className="flex min-h-44 items-center justify-center px-5 text-center">
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay sesiones finalizadas con este ejercicio.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {latestSummary ? (
                    <div className="border-l-2 border-primary/50 pl-3">
                      <p className="text-xs font-medium text-muted-foreground">Última vez</p>
                      <p className="metric-number mt-1 truncate text-sm font-semibold">{latestSummary}</p>
                    </div>
                  ) : null}
                  <ul className="divide-y divide-border/70">
                    {recentSessions.map((session) => {
                      const completedSets = quickHistoryCompletedSets(session);
                      return (
                        <li key={session.sessionId} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex min-h-5 items-baseline justify-between gap-3">
                            <p className="text-sm font-semibold">{formatSessionDate(session.logDate)}</p>
                            <p className="truncate text-xs text-muted-foreground">{session.routineName}</p>
                          </div>
                          {completedSets.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              No hay series completadas en esta sesión.
                            </p>
                          ) : (
                            <ul className="mt-2 space-y-1.5">
                              {completedSets.map((set) => (
                                <li key={set.id} className="flex items-baseline gap-2 text-sm">
                                  <span className="metric-number shrink-0 text-xs font-semibold text-muted-foreground">
                                    S{set.set_number}
                                  </span>
                                  <span className="metric-number min-w-0 font-medium">
                                    {quickHistorySetLabel(set)}
                                  </span>
                                  {set.target_rir !== null ? (
                                    <span className="metric-number shrink-0 text-xs text-muted-foreground">
                                      RIR {set.target_rir}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
