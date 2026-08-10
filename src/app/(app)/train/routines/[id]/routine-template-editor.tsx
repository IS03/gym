"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moveRoutineExerciseTargetAction,
  removeRoutineExerciseAction,
  saveRoutineExerciseTargetAction,
} from "../../actions";
import { nullableNumberFromInput, payloadsEqual } from "@/lib/phase2/training-validation";
import type {
  RoutineExercisePayload,
  RoutineExerciseTemplate,
  TrainingAdjustment,
} from "@/lib/phase2/types";

const ADJUSTMENTS: Array<{ value: TrainingAdjustment; label: string }> = [
  { value: "maintain", label: "Mantener" },
  { value: "increase_weight", label: "+ Peso" },
  { value: "increase_reps", label: "+ Repeticiones" },
  { value: "custom", label: "Personalizado" },
];

type ItemStatus = {
  pending: boolean;
  error: string | null;
  saved: boolean;
};

function payloadFromTemplate(item: RoutineExerciseTemplate): RoutineExercisePayload {
  return {
    next_adjustment: item.next_adjustment,
    notes: item.notes ?? "",
    sets: item.sets.map((set) => ({
      set_number: set.set_number,
      target_reps: set.target_reps,
      target_weight_kg: set.target_weight_kg,
      notes: set.notes,
    })),
  };
}

function renumberSets(payload: RoutineExercisePayload): RoutineExercisePayload {
  return {
    ...payload,
    sets: payload.sets.map((set, index) => ({ ...set, set_number: index + 1 })),
  };
}

export function RoutineTemplateEditor({
  routineId,
  items,
}: {
  routineId: string;
  items: RoutineExerciseTemplate[];
}) {
  const router = useRouter();
  const initialById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, payloadFromTemplate(item)])),
    [items],
  );
  const [savedById, setSavedById] = useState<Record<string, RoutineExercisePayload>>(
    initialById,
  );
  const [overrides, setOverrides] = useState<Record<string, RoutineExercisePayload>>({});
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [moving, startMoveTransition] = useTransition();

  const currentById = useMemo(
    () => ({ ...savedById, ...overrides }),
    [savedById, overrides],
  );
  const dirtyIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => !payloadsEqual(currentById[item.id], savedById[item.id]))
          .map((item) => item.id),
      ),
    [currentById, items, savedById],
  );

  useEffect(() => {
    if (dirtyIds.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyIds.size]);

  function updatePayload(
    id: string,
    updater: (current: RoutineExercisePayload) => RoutineExercisePayload,
  ) {
    setOverrides((current) => {
      const base = current[id] ?? savedById[id];
      return { ...current, [id]: updater(base) };
    });
    setStatuses((current) => ({
      ...current,
      [id]: { pending: false, error: null, saved: false },
    }));
  }

  async function saveItem(id: string) {
    const payload = currentById[id];
    setStatuses((current) => ({
      ...current,
      [id]: { pending: true, error: null, saved: false },
    }));
    const result = await saveRoutineExerciseTargetAction({
      routineId,
      routineExerciseId: id,
      payload,
    });
    if (!result.ok) {
      setStatuses((current) => ({
        ...current,
        [id]: { pending: false, error: result.error, saved: false },
      }));
      return;
    }
    setSavedById((current) => ({ ...current, [id]: payload }));
    setOverrides((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setStatuses((current) => ({
      ...current,
      [id]: { pending: false, error: null, saved: true },
    }));
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (dirtyIds.size > 0) {
      setStatuses((current) => ({
        ...current,
        [id]: {
          pending: false,
          error: "Guardá los objetivos pendientes antes de cambiar el orden.",
          saved: false,
        },
      }));
      return;
    }
    startMoveTransition(async () => {
      const result = await moveRoutineExerciseTargetAction({
        routineId,
        routineExerciseId: id,
        direction,
      });
      if (!result.ok) {
        setStatuses((current) => ({
          ...current,
          [id]: { pending: false, error: result.error, saved: false },
        }));
        return;
      }
      router.refresh();
    });
  }

  function removeItem(item: RoutineExerciseTemplate) {
    if (dirtyIds.has(item.id)) {
      setStatuses((current) => ({
        ...current,
        [item.id]: {
          pending: false,
          error: "Guardá o descartá este cambio antes de quitar el ejercicio.",
          saved: false,
        },
      }));
      return;
    }
    if (!window.confirm(`¿Quitar ${item.exercise.nombre} de esta rutina?`)) return;
    startMoveTransition(async () => {
      const formData = new FormData();
      formData.set("routine_id", routineId);
      formData.set("routine_exercise_id", item.id);
      try {
        await removeRoutineExerciseAction(formData);
        router.refresh();
      } catch (error) {
        setStatuses((current) => ({
          ...current,
          [item.id]: {
            pending: false,
            error: error instanceof Error ? error.message : "No se pudo quitar.",
            saved: false,
          },
        }));
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta rutina todavía no tiene ejercicios.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {dirtyIds.size > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Tenés {dirtyIds.size} objetivo{dirtyIds.size === 1 ? "" : "s"} sin guardar.
        </div>
      ) : null}

      {items.map((item, index) => {
        const payload = currentById[item.id];
        const status = statuses[item.id];
        const dirty = dirtyIds.has(item.id);
        return (
          <Card key={item.id}>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">{item.exercise.nombre}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {item.exercise.muscle_group_label ??
                      item.exercise.grupo_muscular ??
                      "Sin grupo"}
                    {item.exercise.implement ? ` · ${item.exercise.implement}` : ""}
                    {item.exercise.weight_mode ? ` · ${item.exercise.weight_mode}` : ""}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">#{index + 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={moving || index === 0}
                  onClick={() => moveItem(item.id, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={moving || index === items.length - 1}
                  onClick={() => moveItem(item.id, 1)}
                >
                  Bajar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-[44px_1fr_1fr_40px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Serie</span>
                  <span>Reps</span>
                  <span>Peso kg</span>
                  <span className="sr-only">Quitar</span>
                </div>
                {payload.sets.map((set, setIndex) => (
                  <div
                    key={set.set_number}
                    className="grid grid-cols-[44px_1fr_1fr_40px] items-center gap-2"
                  >
                    <span className="text-center text-sm font-medium">{setIndex + 1}</span>
                    <Input
                      aria-label={`Repeticiones objetivo de serie ${setIndex + 1}`}
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      inputMode="numeric"
                      value={set.target_reps ?? ""}
                      onChange={(event) =>
                        updatePayload(item.id, (current) => ({
                          ...current,
                          sets: current.sets.map((currentSet, currentIndex) =>
                            currentIndex === setIndex
                              ? {
                                  ...currentSet,
                                  target_reps: nullableNumberFromInput(event.target.value),
                                }
                              : currentSet,
                          ),
                        }))
                      }
                    />
                    <Input
                      aria-label={`Peso objetivo de serie ${setIndex + 1}`}
                      type="number"
                      min={0}
                      max={9999.99}
                      step="0.5"
                      inputMode="decimal"
                      value={set.target_weight_kg ?? ""}
                      onChange={(event) =>
                        updatePayload(item.id, (current) => ({
                          ...current,
                          sets: current.sets.map((currentSet, currentIndex) =>
                            currentIndex === setIndex
                              ? {
                                  ...currentSet,
                                  target_weight_kg: nullableNumberFromInput(
                                    event.target.value,
                                  ),
                                }
                              : currentSet,
                          ),
                        }))
                      }
                    />
                    <Button
                      aria-label={`Quitar serie ${setIndex + 1}`}
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={payload.sets.length === 1}
                      onClick={() =>
                        updatePayload(item.id, (current) =>
                          renumberSets({
                            ...current,
                            sets: current.sets.filter((_, currentIndex) =>
                              currentIndex !== setIndex,
                            ),
                          }),
                        )
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button
                  className="w-full"
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={payload.sets.length >= 50}
                  onClick={() =>
                    updatePayload(item.id, (current) => {
                      const previous = current.sets.at(-1);
                      return {
                        ...current,
                        sets: [
                          ...current.sets,
                          {
                            set_number: current.sets.length + 1,
                            target_reps: previous?.target_reps ?? null,
                            target_weight_kg: previous?.target_weight_kg ?? null,
                            notes: null,
                          },
                        ],
                      };
                    })
                  }
                >
                  Agregar serie
                </Button>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`adjustment-${item.id}`}>Próxima vez</Label>
                <select
                  id={`adjustment-${item.id}`}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                  value={payload.next_adjustment}
                  onChange={(event) =>
                    updatePayload(item.id, (current) => ({
                      ...current,
                      next_adjustment: event.target.value as TrainingAdjustment,
                    }))
                  }
                >
                  {ADJUSTMENTS.map((adjustment) => (
                    <option key={adjustment.value} value={adjustment.value}>
                      {adjustment.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`notes-${item.id}`}>Notas del objetivo</Label>
                <textarea
                  id={`notes-${item.id}`}
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={payload.notes}
                  onChange={(event) =>
                    updatePayload(item.id, (current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>

              <Button
                className="h-11 w-full"
                type="button"
                disabled={!dirty || status?.pending}
                onClick={() => void saveItem(item.id)}
              >
                {status?.pending ? "Guardando…" : dirty ? "Guardar objetivo" : "Guardado"}
              </Button>
              <Button
                className="h-11 w-full"
                type="button"
                variant="destructive"
                disabled={moving}
                onClick={() => removeItem(item)}
              >
                Quitar de la rutina
              </Button>

              <div aria-live="polite">
                {status?.saved ? (
                  <p className="text-sm text-emerald-600">Objetivo actualizado.</p>
                ) : null}
                {status?.error ? (
                  <p className="text-sm text-destructive">{status.error}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
