"use client";

import { ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreRoutineAction } from "../actions";
import { Button } from "@/components/ui/button";

type Props = {
  routineId: string;
  routineName: string;
  fullWidth?: boolean;
};

export function RoutineRestoreButton({
  routineId,
  routineName,
  fullWidth = false,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function restore() {
    setError(null);
    startTransition(async () => {
      try {
        await restoreRoutineAction(routineId);
        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "No se pudo restaurar la rutina.",
        );
      }
    });
  }

  return (
    <div className={fullWidth ? "w-full" : "shrink-0"}>
      <Button
        type="button"
        variant="outline"
        size={fullWidth ? "default" : "sm"}
        className={fullWidth ? "w-full" : ""}
        disabled={pending}
        onClick={restore}
        aria-label={`Restaurar rutina ${routineName}`}
      >
        <ArchiveRestore className="size-3.5" aria-hidden />
        {pending ? "Restaurando…" : "Restaurar"}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
