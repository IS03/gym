"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS, type MuscleGroupFilter } from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";
import { cn } from "@/lib/utils";
import { addExerciseToRoutineAction } from "../../actions";
import { filterRoutinePickerExercises } from "./routine-editor-interaction";

type RoutinePickerExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  implement: string | null;
  weight_mode: string | null;
};

export function RoutineExerciseAddDialog({
  routineId,
  exercises,
  existingExerciseIds,
  open,
  onOpenChange,
  onAdded,
}: {
  routineId: string;
  exercises: RoutinePickerExercise[];
  existingExerciseIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (routineExerciseId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroupFilter>("all");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existingIds = useMemo(() => new Set(existingExerciseIds), [existingExerciseIds]);
  const filteredExercises = useMemo(
    () => filterRoutinePickerExercises(exercises, existingIds, muscleGroup, search),
    [existingIds, exercises, muscleGroup, search],
  );
  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !pending) onOpenChange(false);
  }

  function addExercise() {
    if (!selectedExercise || existingIds.has(selectedExercise.id)) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("routine_id", routineId);
      formData.set("exercise_id", selectedExercise.id);
      const result = await addExerciseToRoutineAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdded(result.data.routineExerciseId);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden px-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex h-[min(82dvh,44rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.7rem] border border-border bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:h-[min(78dvh,44rem)] lg:rounded-[1.7rem] lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <div className="flex min-h-12 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-lg font-semibold tracking-tight">Agregar ejercicio</Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground">
                    Los ejercicios que ya están en esta rutina no se pueden duplicar.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  type="button"
                  aria-label="Cerrar selector de ejercicios"
                  disabled={pending}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
            </div>

            <div className="shrink-0 border-b border-border/70 px-4 pb-3 pt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  aria-label="Buscar ejercicio"
                  className="pl-9"
                  value={search}
                  placeholder="Buscar ejercicio"
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch]">
                {[{ value: "all" as const, label: "Todos" }, ...MUSCLE_GROUP_OPTIONS].map((group) => {
                  const selected = muscleGroup === group.value;
                  return (
                    <Button
                      key={group.value}
                      type="button"
                      size="sm"
                      variant={selected ? "secondary" : "outline"}
                      className="shrink-0"
                      aria-pressed={selected}
                      onClick={() => setMuscleGroup(group.value)}
                      disabled={pending}
                    >
                      {group.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]">
              {filteredExercises.length === 0 ? (
                <div className="flex min-h-full items-center justify-center py-10 text-center">
                  <div>
                    <p className="text-sm font-medium">No hay ejercicios disponibles</p>
                    <p className="mt-1 text-xs text-muted-foreground">Probá con otro filtro o buscá por nombre.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredExercises.map((exercise) => {
                    const selected = selectedExerciseId === exercise.id;
                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected ? "border-primary/35 bg-primary/[0.07]" : "border-transparent hover:bg-muted/60",
                        )}
                        aria-pressed={selected}
                        onClick={() => setSelectedExerciseId(exercise.id)}
                        disabled={pending}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{exercise.nombre}</span>
                          <span className="block truncate text-xs text-muted-foreground">{exerciseIdentityLabel(exercise)}</span>
                        </span>
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            selected ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-transparent",
                          )}
                          aria-hidden
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border/70 bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <p className="min-h-5 truncate text-xs text-muted-foreground" aria-live="polite">
                {selectedExercise
                  ? `Seleccionado: ${selectedExercise.nombre}`
                  : "Elegí un ejercicio de la lista."}
              </p>
              {error ? <p className="mt-1 text-xs text-destructive" role="alert">{error}</p> : null}
              <Button className="mt-2 h-12 w-full" type="button" disabled={!selectedExercise || pending} onClick={addExercise}>
                {pending ? "Agregando…" : "Agregar a la rutina"}
              </Button>
              <Button className="mt-1 h-10 w-full" type="button" size="sm" variant="ghost" disabled={pending} render={<Link href="/train/exercises" />}>
                <Plus className="size-4" aria-hidden />
                Ir a ejercicios
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
