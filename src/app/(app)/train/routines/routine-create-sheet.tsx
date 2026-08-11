"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { RoutineCreateForm } from "./routine-create-form";

type RoutineCreateSheetProps = {
  children?: ReactNode;
  triggerClassName?: string;
};

export function RoutineCreateSheet({
  children,
  triggerClassName,
}: RoutineCreateSheetProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    setOpen(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        type="button"
        className={triggerClassName}
        aria-label="Nueva rutina"
      >
        {children ?? <><Plus className="size-4" aria-hidden />Nueva rutina</>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[71] flex items-end justify-center overflow-hidden lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(82dvh,34rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:max-h-[min(80dvh,34rem)] lg:max-w-md lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <header className="relative border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <Dialog.Title className="text-xl font-semibold tracking-tight">
                Nueva rutina
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Creá una plantilla y configurala a tu manera.
              </Dialog.Description>
              <Dialog.Close
                type="button"
                aria-label="Cerrar creación de rutina"
                disabled={pending}
                className="absolute right-2 top-7 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 lg:right-3 lg:top-3"
              >
                <X className="size-4.5" aria-hidden />
              </Dialog.Close>
            </header>
            <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <RoutineCreateForm
                autoFocus
                submitLabel="Crear rutina"
                onPendingChange={setPending}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
