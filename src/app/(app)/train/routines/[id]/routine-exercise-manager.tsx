"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addExerciseToRoutineAction } from "../../actions";

type State = { error: string | null };
const initialState: State = { error: null };

export function RoutineExerciseAddForm(props: {
  routineId: string;
  exercises: Array<{ id: string; nombre: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await addExerciseToRoutineAction(formData);
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error inesperado." };
      }
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="routine_id" value={props.routineId} />
      <div className="space-y-1">
        <Label htmlFor="exercise_id">Agregar ejercicio</Label>
        <select
          id="exercise_id"
          name="exercise_id"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          required
        >
          {props.exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.nombre}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending || props.exercises.length === 0}>
        {pending ? "Agregando..." : "Agregar ejercicio"}
      </Button>
    </form>
  );
}

