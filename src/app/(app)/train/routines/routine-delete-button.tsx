"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteRoutineAction } from "../actions";
import { Button } from "@/components/ui/button";

type Props = {
  routineId: string;
  routineName: string;
};

export function RoutineDeleteButton({ routineId, routineName }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function confirmDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("id", routineId);
    startTransition(async () => {
      try {
        await deleteRoutineAction(formData);
        close();
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo eliminar la rutina.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Eliminar rutina ${routineName}`}
        onClick={open}
      >
        <Trash2 className="size-4" />
      </Button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto w-[min(100%,22rem)] rounded-lg border border-border bg-background p-4 text-foreground shadow-lg [&::backdrop]:bg-black/50"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        aria-labelledby="delete-routine-title"
      >
        <h2
          id="delete-routine-title"
          className="text-base font-semibold text-foreground"
        >
          ¿Eliminar esta rutina?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">«{routineName}»</span>{" "}
          se quitará de la lista. Podés cancelar si cambiaste de opinión.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={close}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-10"
            onClick={confirmDelete}
            disabled={pending}
          >
            {pending ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
