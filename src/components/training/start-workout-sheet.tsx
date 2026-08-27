"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Check, ChevronRight, Dumbbell, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { startWorkoutFromSheetAction } from "@/app/(app)/train/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import {
  getInitialWorkoutSelection,
  getWorkoutOptionDelayMs,
  getRoutineStartMeta,
  getWorkoutStartCtaLabel,
  type WorkoutStartActiveSession,
  type WorkoutStartRoutine,
  type WorkoutStartSelection,
} from "@/lib/phase2/workout-start";

type StartWorkoutSheetProps = {
  routines: WorkoutStartRoutine[];
  activeSession: WorkoutStartActiveSession | null;
  initialRoutineId?: string;
  children?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  presentation?: "modal" | "inline";
};

type StartWorkoutContentProps = {
  routines: WorkoutStartRoutine[];
  activeSession: WorkoutStartActiveSession | null;
  selection: WorkoutStartSelection | null;
  pending: boolean;
  error: string | null;
  modal: boolean;
  onSelect: (selection: WorkoutStartSelection) => void;
  onStart: () => void;
};

function StartWorkoutContent({
  routines,
  activeSession,
  selection,
  pending,
  error,
  modal,
  onSelect,
  onStart,
}: StartWorkoutContentProps) {
  const titleClassName = "text-xl font-semibold tracking-tight";
  const descriptionClassName = "mt-1 text-sm text-muted-foreground";
  const ctaLabel = pending
    ? "Iniciando…"
    : getWorkoutStartCtaLabel(selection, routines);

  return (
    <>
      <header className="relative border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
        {modal && (
          <span
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden"
            aria-hidden
          />
        )}
        {modal ? (
          <>
            <Dialog.Title className={titleClassName}>
              {activeSession ? "Sesión en curso" : "Nueva sesión"}
            </Dialog.Title>
            <Dialog.Description className={descriptionClassName}>
              {activeSession
                ? "Ya tenés un entrenamiento activo."
                : "¿Qué vas a entrenar hoy?"}
            </Dialog.Description>
            <Dialog.Close
              type="button"
              aria-label="Cerrar selector"
              disabled={pending}
              className="absolute right-2 top-7 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-50 lg:right-3 lg:top-3"
            >
              <X className="size-4.5" aria-hidden />
            </Dialog.Close>
          </>
        ) : (
          <>
            <h1 className={titleClassName}>
              {activeSession ? "Sesión en curso" : "Nueva sesión"}
            </h1>
            <p className={descriptionClassName}>
              {activeSession
                ? "Ya tenés un entrenamiento activo."
                : "¿Qué vas a entrenar hoy?"}
            </p>
          </>
        )}
      </header>

      {activeSession ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 px-4 py-5 sm:px-5">
            <div
              className={cn(
                "rounded-xl border border-primary/25 bg-primary/[0.06] p-4",
                modal && "workout-active-session-enter",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Dumbbell className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {activeSession.name}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Solo puede haber una sesión en curso. Continuá la existente para
                    seguir registrando tus series.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <footer className="border-t border-border/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 lg:pb-5">
            <Link
              href={`/train/session/${activeSession.id}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              Continuar entrenamiento
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </footer>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div aria-label="Cómo iniciar el entrenamiento">
              {routines.length === 0 ? (
                <div className="mb-4 rounded-xl bg-muted/55 p-4">
                  <p className="text-sm font-medium">Todavía no tenés rutinas.</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Podés empezar una sesión libre o crear una rutina para usarla después.
                  </p>
                  <Link
                    href="/train/routines"
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                  >
                    Crear rutina
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {routines.map((routine, index) => {
                    const selected =
                      selection?.kind === "routine" &&
                      selection.routineId === routine.id;
                    return (
                      <div
                        key={routine.id}
                        style={
                          modal
                            ? ({
                                "--workout-option-delay": `${getWorkoutOptionDelayMs(index)}ms`,
                              } as CSSProperties)
                            : undefined
                        }
                        className={modal ? "workout-option-enter" : undefined}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={pending}
                          onClick={() =>
                            onSelect({ kind: "routine", routineId: routine.id })
                          }
                          className={cn(
                            "workout-option-button flex min-h-16 w-full touch-manipulation items-center gap-3 rounded-xl border bg-background px-3.5 py-3 text-left outline-none transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60",
                            selected &&
                              "border-primary/45 bg-primary/[0.06] shadow-[inset_0_0_0_1px] shadow-primary/10",
                          )}
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-foreground/10"
                            style={{ backgroundColor: routineColorCssVariable(routine.color) }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {routine.name}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {getRoutineStartMeta(routine)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "workout-selection-check flex size-6 shrink-0 items-center justify-center rounded-full border text-primary transition-[background-color,border-color,opacity,transform] duration-150 ease-out",
                              selected
                                ? "scale-100 border-primary/30 bg-primary/10 opacity-100"
                                : "scale-70 border-transparent opacity-0",
                            )}
                            aria-hidden
                          >
                            <Check className="size-3.5" />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="my-4 h-px bg-border/70" aria-hidden />

              <div
                style={
                  modal
                    ? ({
                        "--workout-option-delay": `${getWorkoutOptionDelayMs(routines.length)}ms`,
                      } as CSSProperties)
                    : undefined
                }
                className={modal ? "workout-option-enter" : undefined}
              >
                <button
                  type="button"
                  aria-pressed={selection?.kind === "free"}
                  disabled={pending}
                  onClick={() => onSelect({ kind: "free" })}
                  className={cn(
                    "workout-option-button flex min-h-16 w-full touch-manipulation items-center gap-3 rounded-xl border bg-background px-3.5 py-3 text-left outline-none transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60",
                    selection?.kind === "free" &&
                      "border-primary/45 bg-primary/[0.06] shadow-[inset_0_0_0_1px] shadow-primary/10",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Dumbbell className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Sesión libre</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Empezar sin una rutina
                    </span>
                  </span>
                  <span
                    className={cn(
                      "workout-selection-check flex size-6 shrink-0 items-center justify-center rounded-full border text-primary transition-[background-color,border-color,opacity,transform] duration-150 ease-out",
                      selection?.kind === "free"
                        ? "scale-100 border-primary/30 bg-primary/10 opacity-100"
                        : "scale-70 border-transparent opacity-0",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3.5" />
                  </span>
                </button>
              </div>
            </div>
          </div>

          <footer className="border-t border-border/70 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 lg:pb-5">
            {error && (
              <p
                className={cn(
                  "mb-2 text-sm leading-relaxed text-destructive",
                  modal && "workout-error-enter",
                )}
                role="status"
                aria-live="polite"
              >
                {error}
              </p>
            )}
            <Button
              type="button"
              className="h-12 w-full overflow-hidden font-semibold"
              disabled={!selection || pending}
              onClick={onStart}
            >
              <span
                key={ctaLabel}
                className={modal ? "workout-cta-label" : undefined}
              >
                {ctaLabel}
              </span>
            </Button>
          </footer>
        </div>
      )}
    </>
  );
}

export function StartWorkoutSheet({
  routines,
  activeSession: initialActiveSession,
  initialRoutineId,
  children,
  triggerClassName,
  triggerAriaLabel,
  presentation = "modal",
}: StartWorkoutSheetProps) {
  const router = useRouter();
  const initialSelection = getInitialWorkoutSelection(routines, initialRoutineId);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<WorkoutStartSelection | null>(
    initialSelection,
  );
  const [activeSession, setActiveSession] = useState(initialActiveSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  function resetTransientState() {
    setSelection(initialSelection);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && submittingRef.current) return;
    setOpen(nextOpen);
    if (!nextOpen) resetTransientState();
  }

  function handleSelect(nextSelection: WorkoutStartSelection) {
    if (pending) return;
    setSelection(nextSelection);
    setError(null);
  }

  async function handleStart() {
    if (!selection || submittingRef.current || activeSession) return;
    submittingRef.current = true;
    setPending(true);
    setError(null);
    let navigating = false;

    try {
      const result = await startWorkoutFromSheetAction({
        routineId: selection.kind === "routine" ? selection.routineId : null,
      });

      if (result.status === "started") {
        navigating = true;
        router.push(`/train/session/${result.sessionId}`);
        return;
      }

      if (result.status === "active") {
        setActiveSession(result.session);
        setSelection(null);
        return;
      }

      setError(result.message);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "No pudimos iniciar el entrenamiento. Probá de nuevo.",
      );
    } finally {
      if (!navigating) {
        submittingRef.current = false;
        setPending(false);
      }
    }
  }

  const content = (
    <StartWorkoutContent
      routines={routines}
      activeSession={activeSession}
      selection={selection}
      pending={pending}
      error={error}
      modal={presentation === "modal"}
      onSelect={handleSelect}
      onStart={handleStart}
    />
  );

  if (presentation === "inline") {
    return (
      <div className="mx-auto flex max-h-[min(46rem,calc(100dvh-8rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        {content}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="workout-sheet-backdrop fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Viewport className="fixed inset-0 z-[71] flex items-end justify-center overflow-hidden lg:items-center lg:p-6">
          <Dialog.Popup className="workout-sheet-popup flex max-h-[min(88dvh,52rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none lg:max-h-[min(80dvh,44rem)] lg:max-w-lg lg:rounded-2xl lg:border">
            {content}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
