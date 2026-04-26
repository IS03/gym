"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoutineAction } from "../actions";

type State = { error: string | null };

const initialState: State = { error: null };

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
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await createRoutineAction(formData);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error inesperado." };
      }
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
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
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear"}
      </Button>
    </form>
  );
}

