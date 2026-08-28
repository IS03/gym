"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { addExerciseToRoutineAction } from "../../actions";
import {
  filterExercisesByMuscleGroup,
  MUSCLE_GROUP_OPTIONS,
  type MuscleGroupFilter,
} from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";

type State = { error: string | null };
const initialState: State = { error: null };

export function RoutineExerciseAddForm(props: {
  routineId: string;
  exercises: Array<{
    id: string;
    nombre: string;
    grupo_muscular: MuscleGroup | null;
    muscle_group_label: string | null;
    implement: string | null;
    weight_mode: string | null;
  }>;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await addExerciseToRoutineAction(formData);
        props.onSuccess?.();
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Error inesperado." };
      }
    },
    initialState,
  );
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupFilter>("all");
  const filteredExercises = useMemo(
    () => filterExercisesByMuscleGroup(props.exercises, muscleGroup),
    [muscleGroup, props.exercises],
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState(props.exercises[0]?.id ?? "");
  const exerciseId = filteredExercises.some((exercise) => exercise.id === selectedExerciseId)
    ? selectedExerciseId
    : (filteredExercises[0]?.id ?? "");

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="routine_id" value={props.routineId} />
      <div className="space-y-1">
        <Label htmlFor="exercise-muscle-group">Filtrar por grupo muscular</Label>
        <select
          id="exercise-muscle-group"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={muscleGroup}
          onChange={(event) => setMuscleGroup(event.target.value as MuscleGroupFilter)}
          disabled={pending}
        >
          <option value="all">Todos los grupos</option>
          {MUSCLE_GROUP_OPTIONS.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="exercise_id">Agregar ejercicio</Label>
        <select
          id="exercise_id"
          name="exercise_id"
          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
          value={exerciseId}
          onChange={(event) => setSelectedExerciseId(event.target.value)}
          disabled={filteredExercises.length === 0 || pending}
          required
        >
          {filteredExercises.length === 0 ? (
            <option value="">No hay ejercicios para este grupo</option>
          ) : null}
          {filteredExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.nombre} — {exerciseIdentityLabel(ex)}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button className="h-11 w-full" type="submit" disabled={pending || !exerciseId}>
        {pending ? "Agregando..." : "Agregar ejercicio"}
      </Button>
    </form>
  );
}

export function RoutineExerciseAddDialog(props: {
  routineId: string;
  exercises: Array<{
    id: string;
    nombre: string;
    grupo_muscular: MuscleGroup | null;
    muscle_group_label: string | null;
    implement: string | null;
    weight_mode: string | null;
  }>;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className={props.fullWidth ? "h-11 w-full" : "h-10"}
        onClick={() => setOpen(true)}
      >
        + Agregar ejercicio
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Agregar ejercicio"
        description="Sumalo a la rutina y configurá sus objetivos cuando lo necesites."
        closeLabel="Cerrar agregar ejercicio"
      >
        <RoutineExerciseAddForm
          routineId={props.routineId}
          exercises={props.exercises}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </ResponsiveDialog>
    </>
  );
}
