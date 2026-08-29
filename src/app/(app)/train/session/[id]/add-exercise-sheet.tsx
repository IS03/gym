"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, Check, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import { type MuscleGroupFilter } from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";
import { SessionCreateExerciseForm } from "./session-create-exercise-form";

type PickerExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  implement: string | null;
  weight_mode: string | null;
};

type AddExerciseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  exercises: PickerExercise[];
  filteredExercises: PickerExercise[];
  muscleGroups: Array<{ value: MuscleGroupFilter; label: string }>;
  selectedMuscleGroup: MuscleGroupFilter;
  onMuscleGroupChange: (group: MuscleGroupFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onAddExercise: () => void;
  pending: boolean;
};

export function AddExerciseSheet({
  open,
  onOpenChange,
  sessionId,
  exercises,
  filteredExercises,
  muscleGroups,
  selectedMuscleGroup,
  onMuscleGroupChange,
  search,
  onSearchChange,
  selectedExerciseId,
  onSelectExercise,
  onAddExercise,
  pending,
}: AddExerciseSheetProps) {
  const selectedExercise = exercises.find(
    (exercise) => exercise.id === selectedExerciseId,
  );
  const [creatingExercise, setCreatingExercise] = useState(false);

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) setCreatingExercise(false);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[61] flex items-end justify-center overflow-hidden px-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup className="flex h-[min(82svh,44rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.7rem] border border-border bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:h-[min(78dvh,44rem)] lg:rounded-[1.7rem] lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" />
              <div className="flex min-h-12 items-center gap-2">
                {creatingExercise ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Volver al selector de ejercicios"
                    onClick={() => setCreatingExercise(false)}
                  >
                    <ArrowLeft aria-hidden />
                  </Button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-lg font-semibold tracking-tight">
                    {creatingExercise ? "Crear ejercicio" : "Agregar ejercicio"}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-muted-foreground">
                    {creatingExercise
                      ? "Se agregará a tu biblioteca y a esta sesión."
                      : "Los ejercicios de esta sesión no se pueden duplicar."}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  type="button"
                  aria-label="Cerrar selector de ejercicios"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X className="size-4" aria-hidden />
                </Dialog.Close>
              </div>
            </div>

            {creatingExercise ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
                <SessionCreateExerciseForm
                  sessionId={sessionId}
                  muscleGroups={muscleGroups}
                />
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-border/70 px-4 pb-3 pt-3">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      aria-label="Buscar ejercicio"
                      className="pl-9"
                      value={search}
                      placeholder="Buscar ejercicio"
                      onChange={(event) => onSearchChange(event.target.value)}
                    />
                  </div>
                  <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch]">
                    {[
                      { value: "all" as const, label: "Todos" },
                      ...muscleGroups,
                    ].map((group) => {
                      const selected = selectedMuscleGroup === group.value;
                      return (
                        <Button
                          key={group.value}
                          type="button"
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          className="shrink-0"
                          aria-pressed={selected}
                          onClick={() => onMuscleGroupChange(group.value)}
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
                        <p className="mt-1 text-xs text-muted-foreground">
                          Probá con otro filtro o buscá por nombre.
                        </p>
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
                              selected
                                ? "border-primary/35 bg-primary/[0.07]"
                                : "border-transparent hover:bg-muted/60",
                            )}
                            aria-pressed={selected}
                            onClick={() => onSelectExercise(exercise.id)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {exercise.nombre}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {exerciseIdentityLabel(exercise)}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                                selected
                                  ? "border-primary/35 bg-primary/10 text-primary"
                                  : "border-border text-transparent",
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
                  <p
                    className="min-h-5 truncate text-xs text-muted-foreground"
                    aria-live="polite"
                  >
                    {selectedExercise
                      ? `Seleccionado: ${selectedExercise.nombre}`
                      : "Elegí un ejercicio de la lista."}
                  </p>
                  <Button
                    className="mt-2 h-12 w-full"
                    type="button"
                    disabled={!selectedExercise || pending}
                    onClick={onAddExercise}
                  >
                    {pending ? "Agregando…" : "Agregar a la sesión"}
                  </Button>
                  <Button
                    className="mt-1 h-10 w-full"
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setCreatingExercise(true)}
                  >
                    <Plus className="size-4" aria-hidden />
                    Crear ejercicio nuevo
                  </Button>
                </div>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
