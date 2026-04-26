"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExerciseFromSessionAction } from "../../actions";

type State = { error: string | null };
const initialState: State = { error: null };

export function SessionCreateExerciseForm(props: {
  sessionId: string;
  muscleGroups: Array<{ value: string; label: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await createExerciseFromSessionAction(formData);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error inesperado." };
      }
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="session_id" value={props.sessionId} />
      <div className="space-y-1">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" name="nombre" placeholder="Ej: Press banca" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="grupo_muscular">Grupo muscular</Label>
        <select
          id="grupo_muscular"
          name="grupo_muscular"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue=""
        >
          <option value="">(Sin grupo)</option>
          {props.muscleGroups.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>Valores sugeridos</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            name="series_sugeridas"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Series"
          />
          <Input
            name="reps_sugeridas"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Reps"
          />
          <Input
            name="peso_sugerido"
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            placeholder="Peso"
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear y agregar"}
      </Button>
    </form>
  );
}

