"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type CreateRoutineState,
  createRoutineAction,
} from "../actions";

const initialState: CreateRoutineState = { error: null };

const ROUTINE_COLORS = [
  { value: "", label: "Sin color" },
  { value: "#ef4444", label: "Rojo" },
  { value: "#f97316", label: "Naranja" },
  { value: "#eab308", label: "Amarillo" },
  { value: "#22c55e", label: "Verde" },
  { value: "#06b6d4", label: "Cian" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#a855f7", label: "Violeta" },
] as const;

export function RoutineCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        <Input id="nombre" name="nombre" placeholder="Ej: Pecho" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="color">Color</Label>
        <select
          id="color"
          name="color"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue=""
        >
          {ROUTINE_COLORS.map((c) => (
            <option key={c.value || "none"} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear"}
      </Button>
    </form>
  );
}
