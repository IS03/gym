"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { Routine } from "@/lib/phase2/types";
import { RoutineSettingsForm } from "./routine-settings-form";

export function RoutineSettingsSheet({
  routine,
  open,
  onOpenChange,
  onUpdated,
}: {
  routine: Pick<Routine, "id" | "nombre" | "color">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [pending, setPending] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <header className="relative shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <Dialog.Title className="text-xl font-semibold tracking-tight">Editar rutina</Dialog.Title>
              <Dialog.Description className="mt-1 pr-10 text-sm text-muted-foreground">
                Actualizá su nombre o color. Esto no modifica sesiones anteriores.
              </Dialog.Description>
              <Dialog.Close
                type="button"
                aria-label="Cerrar edición de rutina"
                disabled={pending}
                className="absolute right-3 top-7 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 lg:top-4"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </header>
            <div className="overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
              <RoutineSettingsForm
                routine={routine}
                onPendingChange={setPending}
                onSuccess={() => {
                  onUpdated();
                  onOpenChange(false);
                }}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
