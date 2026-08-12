"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { discardCompletedWorkoutSessionAction } from "../../actions";

export function CompletedSessionActions({
  sessionId,
  sessionName,
  dateLabel,
  timingLabel,
  completedSets,
}: {
  sessionId: string;
  sessionName: string;
  dateLabel: string;
  timingLabel: string | null;
  completedSets: number;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function discard() {
    setError(null);
    startTransition(async () => {
      const result = await discardCompletedWorkoutSessionAction({ sessionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDiscardOpen(false);
      router.replace("/train/history?view=sessions&notice=discarded");
      router.refresh();
    });
  }

  return <>
    <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <Dialog.Trigger render={<Button type="button" size="sm" variant="outline" />}>
        <MoreHorizontal className="size-4" aria-hidden /> Más opciones
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
          <Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-4 shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[starting-style]:translate-y-2">
            <div className="mb-3 flex items-center justify-between gap-3"><Dialog.Title className="text-base font-semibold">Más opciones</Dialog.Title><Dialog.Close className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></Dialog.Close></div>
            <div className="space-y-1">
              <Dialog.Close render={<Link href={`/train/session/${sessionId}/correct`} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors hover:bg-muted" />}><Pencil className="size-4 text-muted-foreground" aria-hidden />Corregir sesión</Dialog.Close>
              <Dialog.Close render={<button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10" onClick={() => setDiscardOpen(true)} />}><Trash2 className="size-4" aria-hidden />Eliminar sesión</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={discardOpen} onOpenChange={setDiscardOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[82] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[83] flex items-end justify-center overflow-hidden sm:items-center sm:p-6">
          <Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none sm:max-w-sm sm:rounded-2xl sm:border sm:data-[ending-style]:translate-y-2 sm:data-[starting-style]:translate-y-2">
            <Dialog.Title className="text-base font-semibold">¿Eliminar esta sesión?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{sessionName}</span><br />{dateLabel}{timingLabel ? ` · ${timingLabel}` : ""}<br />{completedSets} {completedSets === 1 ? "serie" : "series"}. La sesión dejará de aparecer en historial, progreso, volumen, calendario y reportes. Tu rutina actual no se modificará.</Dialog.Description>
            {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><Dialog.Close render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</Dialog.Close><Button type="button" variant="destructive" disabled={pending} onClick={discard}>{pending ? "Eliminando…" : "Eliminar sesión"}</Button></div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
