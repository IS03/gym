"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoutineColorPicker } from "@/components/training/routine-color-picker";
import type { RoutineColorKey } from "@/lib/phase2/routine-colors";
import {
  type CreateRoutineState,
  createRoutineAction,
} from "../actions";

const initialState: CreateRoutineState = { error: null };

export function RoutineCreateForm({
  autoFocus = false,
  submitLabel = "Crear rutina",
  onPendingChange,
}: {
  autoFocus?: boolean;
  submitLabel?: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<RoutineColorKey>("violet");

  useEffect(() => {
    onPendingChange?.(pending);
  }, [onPendingChange, pending]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createRoutineAction(initialState, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id) {
        router.push(`/train/routines/${result.id}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          name="nombre"
          placeholder="Ej: Push B"
          autoFocus={autoFocus}
          required
        />
      </div>
      <RoutineColorPicker value={color} onChange={setColor} />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando…" : submitLabel}
      </Button>
    </form>
  );
}
