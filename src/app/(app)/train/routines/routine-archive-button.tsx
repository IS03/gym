"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Archive, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveRoutineAction } from "../actions";
import { Button } from "@/components/ui/button";

type Props = {
  routineId: string;
  routineName: string;
};

export function RoutineArchiveButton({ routineId, routineName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function archive() {
    setError(null);
    startTransition(async () => {
      try {
        await archiveRoutineAction(routineId);
        setOpen(false);
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "No se pudo archivar la rutina.",
        );
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
        aria-label={`Archivar rutina ${routineName}`}
      >
        <Archive className="size-4" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
          <Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[ending-style]:scale-[0.98] sm:data-[starting-style]:translate-y-2 sm:data-[starting-style]:scale-[0.98]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Archive className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-base font-semibold">
                  ¿Archivar {routineName}?
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  La rutina dejará de aparecer entre tus rutinas activas, pero su historial no se modifica.
                </Dialog.Description>
              </div>
              <Dialog.Close
                type="button"
                aria-label="Cancelar archivado"
                disabled={pending}
                className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </div>
            {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close render={<Button type="button" variant="outline" disabled={pending} />}>
                Cancelar
              </Dialog.Close>
              <Button type="button" variant="destructive" disabled={pending} onClick={archive}>
                {pending ? "Archivando…" : "Archivar"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
