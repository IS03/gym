"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { RoutineColorPicker } from "@/components/training/routine-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Routine } from "@/lib/phase2/types";
import { resolveRoutineColor, type RoutineColorKey } from "@/lib/phase2/routine-colors";
import { updateRoutineAction } from "../../actions";

export function RoutineSettingsForm({
  routine,
  onPendingChange,
  onSuccess,
}: {
  routine: Pick<Routine, "id" | "nombre" | "color">;
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: () => void;
}) {
  const [color, setColor] = useState<RoutineColorKey>(resolveRoutineColor(routine.color));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [onPendingChange, pending]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await updateRoutineAction(formData);
        setSaved(true);
        onSuccess?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo guardar la rutina.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={routine.id} />
      <div className="space-y-1">
        <Label htmlFor="routine-name">Nombre</Label>
        <Input id="routine-name" name="nombre" defaultValue={routine.nombre} required />
      </div>
      <RoutineColorPicker value={color} onChange={setColor} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700 dark:text-emerald-300">Cambios guardados.</p> : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
