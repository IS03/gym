"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Check, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkoutFinishedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionName: string;
  duration: string | null;
  completedSets: number;
  completedExercises: number;
};

function plural(value: number, singular: string, pluralForm: string) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function WorkoutFinishedDialog({
  open,
  onOpenChange,
  sessionName,
  duration,
  completedSets,
  completedExercises,
}: WorkoutFinishedDialogProps) {
  const summary = [
    plural(completedSets, "serie realizada", "series realizadas"),
    plural(completedExercises, "ejercicio", "ejercicios"),
  ].join(" · ");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/35 opacity-100 backdrop-blur-[1px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
          <Dialog.Popup className="w-full rounded-t-[1.5rem] border border-border/80 bg-card p-5 text-card-foreground shadow-2xl shadow-black/20 outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:data-[ending-style]:translate-y-2 sm:data-[ending-style]:scale-[0.98] sm:data-[starting-style]:translate-y-2 sm:data-[starting-style]:scale-[0.98]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                <Check className="size-5" strokeWidth={2.5} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-lg font-semibold tracking-tight">
                  Entrenamiento guardado
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">{sessionName}</span> se guardó correctamente.
                </Dialog.Description>
              </div>
              <Dialog.Close
                type="button"
                aria-label="Ver sesión terminada"
                className="-mr-2 -mt-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5">
              <p className="metric-number text-sm font-semibold text-foreground">{summary}</p>
              {duration ? (
                <p className="metric-number mt-0.5 text-xs text-muted-foreground">{duration}</p>
              ) : null}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Dialog.Close
                render={
                  <Link
                    href="/home"
                    className={cn(buttonVariants(), "h-11 w-full")}
                  />
                }
              >
                Ir al inicio
              </Dialog.Close>
              <Dialog.Close render={<Button type="button" variant="outline" className="h-11 w-full" />}>
                Ver sesión
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
