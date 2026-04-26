"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoutineAction } from "../actions";

type State = { error: string | null };

const initialState: State = { error: null };

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
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear"}
      </Button>
    </form>
  );
}

