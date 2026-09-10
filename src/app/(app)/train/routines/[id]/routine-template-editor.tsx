"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowDown, ArrowUp, Check, ChevronDown, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalizedDecimalInput } from "@/components/ui/localized-decimal-input";
import { Label } from "@/components/ui/label";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import { routineColorCssVariable, type RoutineColorKey } from "@/lib/phase2/routine-colors";
import { summarizeRoutineExerciseTarget } from "@/lib/phase2/routine-template-summary";
import { formatRestRange } from "@/lib/phase2/training-display";
import { nullableNumberFromInput, payloadsEqual } from "@/lib/phase2/training-validation";
import type {
  RoutineExercisePayload,
  RoutineExerciseTemplate,
} from "@/lib/phase2/types";
import {
  moveRoutineExerciseTargetAction,
  removeRoutineExerciseAction,
  saveRoutineExerciseTargetAction,
} from "../../actions";
import {
  nextExpandedRoutineExerciseId,
  toggleRoutineNextAdjustment,
  type SelectableRoutineAdjustment,
} from "./routine-editor-interaction";

const NEXT_TIME_TOGGLES: Array<{ value: SelectableRoutineAdjustment; label: string }> = [
  { value: "increase_weight", label: "+ Peso" },
  { value: "increase_reps", label: "+ Repeticiones" },
];

type ItemStatus = { pending: boolean; error: string | null; saved: boolean };

function payloadFromTemplate(item: RoutineExerciseTemplate): RoutineExercisePayload {
  return {
    next_adjustment: item.next_adjustment,
    rest_min_seconds: item.rest_min_seconds,
    rest_max_seconds: item.rest_max_seconds,
    notes: item.notes ?? "",
    sets: item.sets.map((set) => ({
      set_number: set.set_number,
      target_reps: set.target_reps,
      target_weight_kg: set.target_weight_kg,
      target_rir: set.target_rir,
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
  routineColor,
  items,
  initialExpandedExerciseId,
  onDirtyChange,
}: {
  routineId: string;
  routineColor: RoutineColorKey | null;
  items: RoutineExerciseTemplate[];
  initialExpandedExerciseId?: string | null;
  onDirtyChange?: (dirtyCount: number) => void;
}) {
  const router = useRouter();
  const initialById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, payloadFromTemplate(item)])),
    [items],
  );
  const [savedById, setSavedById] = useState<Record<string, RoutineExercisePayload>>(initialById);
  const [overrides, setOverrides] = useState<Record<string, RoutineExercisePayload>>({});
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(
    initialExpandedExerciseId ?? null,
  );
  const [removeTarget, setRemoveTarget] = useState<RoutineExerciseTemplate | null>(null);
  const [moving, startMoveTransition] = useTransition();
  const currentById = useMemo(() => ({ ...savedById, ...overrides }), [overrides, savedById]);
  const dirtyIds = useMemo(
    () => new Set(items
      .filter((item) => !payloadsEqual(currentById[item.id] ?? initialById[item.id], savedById[item.id] ?? initialById[item.id]))
      .map((item) => item.id)),
    [currentById, initialById, items, savedById],
  );

  useEffect(() => {
    setSavedById((current) => Object.fromEntries(items.map((item) => [
      item.id,
      current[item.id] ?? initialById[item.id],
    ])));
    setOverrides((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => items.some((item) => item.id === id)),
    ));
    setStatuses((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => items.some((item) => item.id === id)),
    ));
  }, [initialById, items]);

  useEffect(() => {
    if (initialExpandedExerciseId && items.some((item) => item.id === initialExpandedExerciseId)) {
      setExpandedExerciseId(initialExpandedExerciseId);
    }
  }, [initialExpandedExerciseId, items]);

  useEffect(() => {
    onDirtyChange?.(dirtyIds.size);
  }, [dirtyIds.size, onDirtyChange]);

  useEffect(() => {
    if (dirtyIds.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyIds.size]);

  function updatePayload(
    id: string,
    updater: (current: RoutineExercisePayload) => RoutineExercisePayload,
  ) {
    setOverrides((current) => ({
      ...current,
      [id]: updater(current[id] ?? savedById[id] ?? initialById[id]),
    }));
    setStatuses((current) => ({ ...current, [id]: { pending: false, error: null, saved: false } }));
  }

  async function saveItem(id: string) {
    const payload = currentById[id] ?? initialById[id];
    setStatuses((current) => ({ ...current, [id]: { pending: true, error: null, saved: false } }));
    try {
      const result = await saveRoutineExerciseTargetAction({
        routineId,
        routineExerciseId: id,
        payload,
      });
      if (!result.ok) {
        setStatuses((current) => ({ ...current, [id]: { pending: false, error: result.error, saved: false } }));
        return;
      }
      setSavedById((current) => ({ ...current, [id]: payload }));
      setOverrides((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setStatuses((current) => ({ ...current, [id]: { pending: false, error: null, saved: true } }));
      window.setTimeout(() => setStatuses((current) => (
        current[id]?.saved
          ? { ...current, [id]: { ...current[id], saved: false } }
          : current
      )), 2400);
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [id]: {
          pending: false,
          error: error instanceof Error ? error.message : "No se pudo guardar el objetivo.",
          saved: false,
        },
      }));
    }
  }

  function blockStructuralMutation(id: string) {
    setExpandedExerciseId(id);
    setStatuses((current) => ({
      ...current,
      [id]: {
        pending: false,
        error: "Guardá los objetivos pendientes antes de cambiar la estructura de la rutina.",
        saved: false,
      },
    }));
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (dirtyIds.size > 0) {
      blockStructuralMutation(id);
      return;
    }
    startMoveTransition(async () => {
      const result = await moveRoutineExerciseTargetAction({ routineId, routineExerciseId: id, direction });
      if (!result.ok) {
        setStatuses((current) => ({ ...current, [id]: { pending: false, error: result.error, saved: false } }));
        return;
      }
      router.refresh();
    });
  }

  function requestRemove(item: RoutineExerciseTemplate) {
    if (dirtyIds.size > 0) {
      blockStructuralMutation(item.id);
      return;
    }
    setRemoveTarget(item);
  }

  function removeItem() {
    if (!removeTarget) return;
    const target = removeTarget;
    startMoveTransition(async () => {
      const formData = new FormData();
      formData.set("routine_id", routineId);
      formData.set("routine_exercise_id", target.id);
      try {
        await removeRoutineExerciseAction(formData);
        setRemoveTarget(null);
        router.refresh();
      } catch (error) {
        setStatuses((current) => ({
          ...current,
          [target.id]: {
            pending: false,
            error: error instanceof Error ? error.message : "No se pudo quitar el ejercicio.",
            saved: false,
          },
        }));
        setRemoveTarget(null);
      }
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <div className="divide-y divide-border/70 rounded-xl border border-border/80 bg-card shadow-sm">
        {items.map((item, index) => {
          const payload = currentById[item.id] ?? initialById[item.id];
          const status = statuses[item.id];
          const dirty = dirtyIds.has(item.id);
          const isOpen = expandedExerciseId === item.id;
          const summary = summarizeRoutineExerciseTarget(payload);
          const identity = exerciseIdentityLabel(item.exercise);
          const contentId = `routine-target-${item.id}`;

          return (
            <article key={item.id} className="relative">
              <span
                className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full transition-opacity duration-200 motion-reduce:transition-none ${isOpen ? "opacity-100" : "opacity-65"}`}
                style={{ backgroundColor: routineColorCssVariable(routineColor) }}
                aria-hidden
              />
              <div className="flex items-center pr-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => setExpandedExerciseId((current) => nextExpandedRoutineExerciseId(current, item.id))}
                  className="flex min-h-[72px] min-w-0 flex-1 items-start gap-2.5 py-2.5 pr-2 pl-4 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="metric-number mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-5">{item.exercise.nombre}</span>
                    <span className="block truncate text-xs leading-4 text-muted-foreground">{identity}</span>
                    <span className="block truncate text-xs leading-4 text-muted-foreground">
                      {[summary.setLabel, ...summary.signals, summary.adjustmentLabel].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronDown
                    className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                <details className="group/actions relative shrink-0">
                  <summary
                    aria-label={`Acciones de ${item.exercise.nombre}`}
                    className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </summary>
                  <div className="absolute top-11 right-0 z-30 w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
                    <Button className="w-full justify-start" type="button" size="sm" variant="ghost" disabled={moving || index === 0} onClick={() => moveItem(item.id, -1)}>
                      <ArrowUp className="size-3.5" aria-hidden />
                      Mover arriba
                    </Button>
                    <Button className="w-full justify-start" type="button" size="sm" variant="ghost" disabled={moving || index === items.length - 1} onClick={() => moveItem(item.id, 1)}>
                      <ArrowDown className="size-3.5" aria-hidden />
                      Mover abajo
                    </Button>
                    <div className="my-1 border-t" />
                    <Button className="w-full justify-start text-destructive hover:text-destructive" type="button" size="sm" variant="ghost" disabled={moving} onClick={() => requestRemove(item)}>
                      <Trash2 className="size-3.5" aria-hidden />
                      Quitar de la rutina
                    </Button>
                  </div>
                </details>
              </div>

              {isOpen ? (
                <div id={contentId} className="space-y-4 border-t px-4 pt-3 pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
                  <div className="flex min-h-9 items-center justify-between gap-3" aria-live="polite">
                    <p className="text-xs font-medium">
                      {dirty ? (
                        <span className="text-amber-700 dark:text-amber-300">Cambios sin guardar</span>
                      ) : status?.saved ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <Check className="size-3.5" aria-hidden />
                          Guardado
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Objetivo guardado</span>
                      )}
                    </p>
                    <Button type="button" size="sm" disabled={!dirty || status?.pending} onClick={() => void saveItem(item.id)}>
                      {status?.pending ? "Guardando…" : "Guardar cambios"}
                    </Button>
                  </div>

                  <section className="space-y-2.5" aria-labelledby={`sets-title-${item.id}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id={`sets-title-${item.id}`} className="text-sm font-semibold">Series</h3>
                      <p className="text-xs text-muted-foreground">Objetivo por serie</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2rem] items-center gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                        <span>#</span><span>Reps</span><span>Peso</span><span>RIR</span><span className="sr-only">Quitar</span>
                      </div>
                      {payload.sets.map((set, setIndex) => (
                        <div key={set.set_number} className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_3rem_2rem] items-center gap-1.5">
                          <span className="metric-number text-center text-sm font-medium">{setIndex + 1}</span>
                          <Input
                            aria-label={`Repeticiones objetivo de serie ${setIndex + 1}`}
                            className="metric-number h-10 min-w-0 px-1 text-center"
                            type="number"
                            min={0}
                            max={1000}
                            step={1}
                            inputMode="numeric"
                            value={set.target_reps ?? ""}
                            onChange={(event) => updatePayload(item.id, (current) => ({
                              ...current,
                              sets: current.sets.map((target, targetIndex) => (
                                targetIndex === setIndex
                                  ? { ...target, target_reps: nullableNumberFromInput(event.target.value) }
                                  : target
                              )),
                            }))}
                          />
                          <LocalizedDecimalInput
                            aria-label={`Peso objetivo de serie ${setIndex + 1}`}
                            className="metric-number h-10 min-w-0 px-1 text-center"
                            min={0}
                            max={9999.99}
                            value={set.target_weight_kg}
                            onValueChange={(value) => updatePayload(item.id, (current) => ({
                              ...current,
                              sets: current.sets.map((target, targetIndex) => (
                                targetIndex === setIndex
                                  ? { ...target, target_weight_kg: value }
                                  : target
                              )),
                            }))}
                          />
                          <Input
                            aria-label={`RIR objetivo de serie ${setIndex + 1}`}
                            className="metric-number h-10 min-w-0 px-1 text-center"
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            inputMode="numeric"
                            value={set.target_rir ?? ""}
                            onChange={(event) => updatePayload(item.id, (current) => ({
                              ...current,
                              sets: current.sets.map((target, targetIndex) => (
                                targetIndex === setIndex
                                  ? { ...target, target_rir: nullableNumberFromInput(event.target.value) }
                                  : target
                              )),
                            }))}
                          />
                          <Button
                            aria-label={`Quitar serie ${setIndex + 1}`}
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={payload.sets.length === 1}
                            onClick={() => updatePayload(item.id, (current) => renumberSets({
                              ...current,
                              sets: current.sets.filter((_, targetIndex) => targetIndex !== setIndex),
                            }))}
                          >
                            <X className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="h-9 w-full"
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={payload.sets.length >= 50}
                      onClick={() => updatePayload(item.id, (current) => {
                        const previous = current.sets.at(-1);
                        return {
                          ...current,
                          sets: [
                            ...current.sets,
                            {
                              set_number: current.sets.length + 1,
                              target_reps: previous?.target_reps ?? null,
                              target_weight_kg: previous?.target_weight_kg ?? null,
                              target_rir: previous?.target_rir ?? null,
                              notes: null,
                            },
                          ],
                        };
                      })}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Agregar serie
                    </Button>
                  </section>

                  <section className="space-y-2.5 border-t pt-3" aria-labelledby={`configuration-title-${item.id}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id={`configuration-title-${item.id}`} className="text-sm font-semibold">Descanso</h3>
                      <p className="text-xs text-muted-foreground">{formatRestRange(payload.rest_min_seconds, payload.rest_max_seconds) ?? "Sin objetivo"}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label htmlFor={`rest-min-${item.id}`} className="text-xs">Mínimo (seg)</Label><Input id={`rest-min-${item.id}`} className="metric-number h-10 text-center" type="number" min={0} max={3600} step={1} inputMode="numeric" value={payload.rest_min_seconds ?? ""} onChange={(event) => updatePayload(item.id, (current) => ({ ...current, rest_min_seconds: nullableNumberFromInput(event.target.value) }))} /></div>
                      <div className="space-y-1"><Label htmlFor={`rest-max-${item.id}`} className="text-xs">Máximo (seg)</Label><Input id={`rest-max-${item.id}`} className="metric-number h-10 text-center" type="number" min={0} max={3600} step={1} inputMode="numeric" value={payload.rest_max_seconds ?? ""} onChange={(event) => updatePayload(item.id, (current) => ({ ...current, rest_max_seconds: nullableNumberFromInput(event.target.value) }))} /></div>
                    </div>
                  </section>

                  <section className="space-y-2 border-t pt-3" aria-labelledby={`next-time-title-${item.id}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 id={`next-time-title-${item.id}`} className="text-sm font-semibold">Próxima vez</h3>
                      {payload.next_adjustment === "custom" ? (
                        <div className="min-w-0 text-right text-xs text-muted-foreground">
                          <p>Ajuste anterior: Personalizado</p>
                          {item.next_adjustment_note?.trim() ? (
                            <p className="mt-0.5 truncate">{item.next_adjustment_note.trim()}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {NEXT_TIME_TOGGLES.map((adjustment) => {
                        const selected = payload.next_adjustment === adjustment.value;
                        return (
                          <Button
                            key={adjustment.value}
                            type="button"
                            size="sm"
                            variant={selected ? "secondary" : "outline"}
                            aria-pressed={selected}
                            onClick={() => updatePayload(item.id, (current) => ({
                              ...current,
                              next_adjustment: toggleRoutineNextAdjustment(
                                current.next_adjustment,
                                adjustment.value,
                              ),
                            }))}
                          >
                            {adjustment.label}
                          </Button>
                        );
                      })}
                    </div>
                  </section>

                  <details className="group border-t pt-2">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span>Observaciones</span>
                      <span className="min-w-0 flex-1 truncate text-right text-xs font-normal text-muted-foreground">{payload.notes || "Opcional"}</span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                    </summary>
                    <div className="pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150">
                      <Label htmlFor={`notes-${item.id}`} className="sr-only">Observaciones de {item.exercise.nombre}</Label>
                      <textarea
                        id={`notes-${item.id}`}
                        className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        value={payload.notes}
                        placeholder="Técnica, agarre o posición"
                        onChange={(event) => updatePayload(item.id, (current) => ({ ...current, notes: event.target.value }))}
                      />
                    </div>
                  </details>

                  <div aria-live="polite">
                    {status?.error ? <p className="text-sm text-destructive" role="alert">{status.error}</p> : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <Dialog.Root open={removeTarget !== null} onOpenChange={(open) => { if (!open && !moving) setRemoveTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center p-0 sm:items-center sm:p-6">
            <Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none sm:max-w-sm sm:rounded-2xl sm:border">
              <Dialog.Title className="text-base font-semibold">¿Quitar {removeTarget?.exercise.nombre}?</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Se quitará de esta rutina. El ejercicio seguirá disponible en tu biblioteca y las sesiones anteriores no cambian.
              </Dialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={moving} onClick={() => setRemoveTarget(null)}>Cancelar</Button>
                <Button type="button" variant="destructive" disabled={moving} onClick={removeItem}>{moving ? "Quitando…" : "Quitar"}</Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
