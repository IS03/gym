"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXERCISE_IMPLEMENT_SUGGESTIONS,
  EXERCISE_WEIGHT_MODE_SUGGESTIONS,
} from "@/lib/phase2/exercise-mutation";
import { createExerciseFromSessionAction } from "../../actions";

type State = { error: string | null };
const initialState: State = { error: null };

export function SessionCreateExerciseForm(props: {
  sessionId: string;
  muscleGroups: Array<{ value: string; label: string }>;
  readOnly?: boolean;
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

  if (props.readOnly) {
    return (
      <p className="text-sm text-muted-foreground">La sesión está finalizada.</p>
    );
  }

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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            type="text"
            min={0}
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder="Peso"
          />
          <Input
            name="rir_sugerido"
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
            placeholder="RIR"
            aria-label="RIR sugerido"
          />
          <Input
            name="descanso_min_sugerido_segundos"
            type="number"
            min={0}
            max={3600}
            step={1}
            inputMode="numeric"
            placeholder="Desc. mín. (s)"
            aria-label="Descanso mínimo sugerido en segundos"
          />
          <Input
            name="descanso_max_sugerido_segundos"
            type="number"
            min={0}
            max={3600}
            step={1}
            inputMode="numeric"
            placeholder="Desc. máx. (s)"
            aria-label="Descanso máximo sugerido en segundos"
          />
        </div>
        <p className="text-xs text-muted-foreground">Segundos totales.</p>
      </div>
      <fieldset className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3">
        <legend className="px-1 text-sm font-medium">Detalles</legend>
        <div className="space-y-1">
          <Label htmlFor="muscle_group_label" className="text-xs text-muted-foreground">Detalle muscular</Label>
          <Input id="muscle_group_label" name="muscle_group_label" placeholder="Ej: Deltoides posteriores" maxLength={120} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="implement" className="text-xs text-muted-foreground">Implemento</Label>
            <Input id="implement" name="implement" placeholder="Ej: Polea" list="session-exercise-implement-suggestions" maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="weight_mode" className="text-xs text-muted-foreground">Registro de carga</Label>
            <Input id="weight_mode" name="weight_mode" placeholder="Ej: Peso total" list="session-exercise-weight-mode-suggestions" maxLength={120} />
          </div>
        </div>
        <datalist id="session-exercise-implement-suggestions">
          {EXERCISE_IMPLEMENT_SUGGESTIONS.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="session-exercise-weight-mode-suggestions">
          {EXERCISE_WEIGHT_MODE_SUGGESTIONS.map((value) => <option key={value} value={value} />)}
        </datalist>
      </fieldset>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear y agregar"}
      </Button>
    </form>
  );
}
