"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  appendWorkoutExerciseAction,
  cancelWorkoutSessionAction,
  finishWorkoutSessionAction,
  removeSessionExerciseAction,
  saveWorkoutExerciseAction,
} from "../../actions";
import {
  getDraftSnapshot,
  getServerDraftSnapshot,
  parseSessionMetadataDraft,
  parseWorkoutExerciseDraft,
  removeDraft,
  sessionMetadataDraftKey,
  subscribeDraftStore,
  TRAINING_DRAFT_VERSION,
  workoutDraftKey,
  writeDraft,
} from "@/lib/phase2/training-drafts";
import {
  nullableNumberFromInput,
  payloadsEqual,
} from "@/lib/phase2/training-validation";
import type {
  SessionMetadataInput,
  TrainingAdjustment,
  WorkoutExercisePayload,
  WorkoutSessionClientDetail,
} from "@/lib/phase2/types";
import {
  completionStats,
  renumberWorkoutPayload,
  sessionMetadataFromSession,
  workoutPayloadFromDetail,
} from "./session-editor-helpers";
import { SessionCreateExerciseForm } from "./session-create-exercise-form";

const ADJUSTMENTS: Array<{ value: TrainingAdjustment; label: string }> = [
  { value: "maintain", label: "Mantener" },
  { value: "increase_weight", label: "+ Peso" },
  { value: "increase_reps", label: "+ Repeticiones" },
  { value: "custom", label: "Personalizado" },
];

const MUSCLE_GROUPS = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "bíceps", label: "Bíceps" },
  { value: "tríceps", label: "Tríceps" },
  { value: "abdomen", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
] as const;

type ExerciseStatus = {
  pending: boolean;
  saved: boolean;
  error: string | null;
};

function snapshotRecord(snapshot: string): Record<string, string | null> {
  try {
    const value: unknown = JSON.parse(snapshot);
    return typeof value === "object" && value !== null
      ? (value as Record<string, string | null>)
      : {};
  } catch {
    return {};
  }
}

function metadataInput(
  value: number | null,
  onChange: (next: number | null) => void,
  props: { min: number; max: number; step?: number | string; label: string },
) {
  return (
    <Input
      aria-label={props.label}
      type="number"
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      inputMode={props.step && props.step !== 1 ? "decimal" : "numeric"}
      value={value ?? ""}
      onChange={(event) => onChange(nullableNumberFromInput(event.target.value))}
    />
  );
}

export function SessionEditor({
  detail,
  libraryExercises,
}: {
  detail: WorkoutSessionClientDetail;
  libraryExercises: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const readOnly = detail.session.status === "completed";
  const exerciseIds = useMemo(
    () => detail.exercises.map((exercise) => exercise.id),
    [detail.exercises],
  );
  const metadataKey = sessionMetadataDraftKey(detail.session.id);
  const draftKeys = useMemo(
    () => [
      metadataKey,
      ...exerciseIds.map((exerciseId) => workoutDraftKey(detail.session.id, exerciseId)),
    ],
    [detail.session.id, exerciseIds, metadataKey],
  );
  const draftSnapshot = useSyncExternalStore(
    subscribeDraftStore,
    () => getDraftSnapshot(draftKeys),
    getServerDraftSnapshot,
  );
  const rawDrafts = useMemo(() => snapshotRecord(draftSnapshot), [draftSnapshot]);

  const initialPayloads = useMemo(
    () =>
      Object.fromEntries(
        detail.exercises.map((exercise) => [exercise.id, workoutPayloadFromDetail(exercise)]),
      ),
    [detail.exercises],
  );
  const initialVersions = useMemo(
    () =>
      Object.fromEntries(
        detail.exercises.map((exercise) => [exercise.id, exercise.updated_at]),
      ),
    [detail.exercises],
  );
  const [serverPayloads, setServerPayloads] = useState<
    Record<string, WorkoutExercisePayload>
  >(initialPayloads);
  const [serverVersions, setServerVersions] = useState<Record<string, string>>(
    initialVersions,
  );
  const [overrides, setOverrides] = useState<Record<string, WorkoutExercisePayload>>({});
  const [statuses, setStatuses] = useState<Record<string, ExerciseStatus>>({});
  const [storageError, setStorageError] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalPending, setGlobalPending] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState(
    libraryExercises[0]?.id ?? "",
  );

  const baseMetadata = useMemo(
    () => sessionMetadataFromSession(detail.session),
    [detail.session],
  );
  const metadataDraft = readOnly
    ? null
    : parseSessionMetadataDraft(rawDrafts[metadataKey] ?? null, detail.session.id);
  const [metadataOverride, setMetadataOverride] = useState<SessionMetadataInput | null>(null);
  const metadata = readOnly
    ? baseMetadata
    : metadataOverride ?? metadataDraft?.metadata ?? baseMetadata;

  const draftById = useMemo(
    () =>
      Object.fromEntries(
        exerciseIds.map((exerciseId) => {
          const key = workoutDraftKey(detail.session.id, exerciseId);
          return [
            exerciseId,
            readOnly
              ? null
              : parseWorkoutExerciseDraft(rawDrafts[key] ?? null, exerciseId),
          ];
        }),
      ),
    [detail.session.id, exerciseIds, rawDrafts, readOnly],
  );

  const currentPayloads = useMemo(() => {
    const result: Record<string, WorkoutExercisePayload> = {};
    for (const exerciseId of exerciseIds) {
      const draft = draftById[exerciseId];
      const draftIsCurrent = draft?.serverUpdatedAt === serverVersions[exerciseId];
      result[exerciseId] = readOnly
        ? serverPayloads[exerciseId]
        : overrides[exerciseId] ??
          (draftIsCurrent ? draft.payload : null) ??
          serverPayloads[exerciseId];
    }
    return result;
  }, [draftById, exerciseIds, overrides, readOnly, serverPayloads, serverVersions]);

  const staleDraftIds = useMemo(
    () =>
      new Set(
        exerciseIds.filter((exerciseId) => {
          const draft = draftById[exerciseId];
          return draft !== null && draft.serverUpdatedAt !== serverVersions[exerciseId];
        }),
      ),
    [draftById, exerciseIds, serverVersions],
  );
  const dirtyIds = useMemo(
    () =>
      new Set(
        exerciseIds.filter(
          (exerciseId) =>
            !payloadsEqual(currentPayloads[exerciseId], serverPayloads[exerciseId]),
        ),
      ),
    [currentPayloads, exerciseIds, serverPayloads],
  );
  const metadataDirty = !readOnly && !payloadsEqual(metadata, baseMetadata);
  const stats = completionStats(Object.values(currentPayloads));
  const hasUnsavedWork = dirtyIds.size > 0 || metadataDirty;

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedWork]);

  function persistExerciseDraft(exerciseId: string, payload: WorkoutExercisePayload) {
    const saved = writeDraft(workoutDraftKey(detail.session.id, exerciseId), {
      version: TRAINING_DRAFT_VERSION,
      sessionExerciseId: exerciseId,
      serverUpdatedAt: serverVersions[exerciseId],
      savedAt: new Date().toISOString(),
      payload,
    });
    if (!saved) setStorageError(true);
  }

  function updateExercise(
    exerciseId: string,
    updater: (current: WorkoutExercisePayload) => WorkoutExercisePayload,
  ) {
    const next = updater(currentPayloads[exerciseId]);
    setOverrides((current) => ({ ...current, [exerciseId]: next }));
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: false, saved: false, error: null },
    }));
    persistExerciseDraft(exerciseId, next);
  }

  function updateMetadata(
    updater: (current: SessionMetadataInput) => SessionMetadataInput,
  ) {
    const next = updater(metadata);
    setMetadataOverride(next);
    const saved = writeDraft(metadataKey, {
      version: TRAINING_DRAFT_VERSION,
      sessionId: detail.session.id,
      savedAt: new Date().toISOString(),
      metadata: next,
    });
    if (!saved) setStorageError(true);
  }

  function discardExerciseDraft(exerciseId: string) {
    setOverrides((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: false, saved: false, error: null },
    }));
    removeDraft(workoutDraftKey(detail.session.id, exerciseId));
  }

  async function saveExercise(exerciseId: string) {
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: true, saved: false, error: null },
    }));
    const payload = currentPayloads[exerciseId];
    const result = await saveWorkoutExerciseAction({
      sessionId: detail.session.id,
      sessionExerciseId: exerciseId,
      expectedUpdatedAt: serverVersions[exerciseId],
      payload,
    });
    if (!result.ok) {
      setStatuses((current) => ({
        ...current,
        [exerciseId]: { pending: false, saved: false, error: result.error },
      }));
      return;
    }

    setServerPayloads((current) => ({ ...current, [exerciseId]: payload }));
    setServerVersions((current) => ({
      ...current,
      [exerciseId]: result.data.updatedAt,
    }));
    setOverrides((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
    removeDraft(workoutDraftKey(detail.session.id, exerciseId));
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: false, saved: true, error: null },
    }));
  }

  async function addExistingExercise() {
    if (!selectedExerciseId) return;
    setGlobalPending(true);
    setGlobalError(null);
    const result = await appendWorkoutExerciseAction({
      sessionId: detail.session.id,
      exerciseId: selectedExerciseId,
    });
    setGlobalPending(false);
    if (!result.ok) {
      setGlobalError(result.error);
      return;
    }
    router.refresh();
  }

  async function removeExercise(exerciseId: string, name: string) {
    if (dirtyIds.has(exerciseId)) {
      setStatuses((current) => ({
        ...current,
        [exerciseId]: {
          pending: false,
          saved: false,
          error: "Descartá o guardá el borrador antes de quitar este ejercicio.",
        },
      }));
      return;
    }
    if (!window.confirm(`¿Quitar ${name} de esta sesión?`)) return;
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: true, saved: false, error: null },
    }));
    const formData = new FormData();
    formData.set("session_id", detail.session.id);
    formData.set("id", exerciseId);
    try {
      await removeSessionExerciseAction(formData);
      removeDraft(workoutDraftKey(detail.session.id, exerciseId));
      router.refresh();
    } catch (error) {
      setStatuses((current) => ({
        ...current,
        [exerciseId]: {
          pending: false,
          saved: false,
          error: error instanceof Error ? error.message : "No se pudo quitar.",
        },
      }));
    }
  }

  async function finishSession() {
    if (dirtyIds.size > 0) {
      setGlobalError("Guardá o descartá todos los ejercicios pendientes antes de finalizar.");
      return;
    }
    if (stats.completedSets === 0) {
      setGlobalError("Marcá y guardá al menos una serie antes de finalizar.");
      return;
    }
    setGlobalPending(true);
    setGlobalError(null);
    const result = await finishWorkoutSessionAction({
      sessionId: detail.session.id,
      metadata,
    });
    setGlobalPending(false);
    if (!result.ok) {
      setGlobalError(result.error);
      return;
    }
    for (const key of draftKeys) removeDraft(key);
    router.replace(`/train/session/${detail.session.id}`);
    router.refresh();
  }

  async function cancelSession() {
    if (
      !window.confirm(
        "¿Cancelar este borrador de sesión? Se eliminará la sesión en curso, pero no las rutinas ni el historial anterior.",
      )
    ) {
      return;
    }
    setGlobalPending(true);
    setGlobalError(null);
    const result = await cancelWorkoutSessionAction({ sessionId: detail.session.id });
    setGlobalPending(false);
    if (!result.ok) {
      setGlobalError(result.error);
      return;
    }
    for (const key of draftKeys) removeDraft(key);
    router.replace("/train");
    router.refresh();
  }

  function confirmNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      hasUnsavedWork &&
      !window.confirm("Hay cambios guardados solo como borrador local. ¿Salir igualmente?")
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.session.session_name ??
            detail.session.routine_name_snapshot ??
            "Sesión libre"}
        </h1>
        <p className="text-sm text-muted-foreground">{detail.logDate}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border p-2">
            <div className="font-semibold">{stats.completedExercises}</div>
            <div className="text-muted-foreground">Ejercicios</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="font-semibold">
              {stats.completedSets}/{stats.totalSets}
            </div>
            <div className="text-muted-foreground">Series</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="font-semibold">{dirtyIds.size}</div>
            <div className="text-muted-foreground">Pendientes</div>
          </div>
        </div>
      </div>

      {!readOnly && (dirtyIds.size > 0 || metadataDirty) ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          El borrador queda en este dispositivo. Guardá cada ejercicio antes de finalizar.
        </div>
      ) : null}
      {storageError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          El navegador no permitió guardar el borrador local. No cierres esta pestaña hasta
          guardar los ejercicios.
        </div>
      ) : null}

      {!readOnly ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agregar ejercicio extra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              aria-label="Ejercicio extra"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              disabled={libraryExercises.length === 0 || globalPending}
            >
              {libraryExercises.length === 0 ? (
                <option value="">No hay ejercicios disponibles</option>
              ) : (
                libraryExercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.nombre}
                  </option>
                ))
              )}
            </select>
            <Button
              className="h-11 w-full"
              type="button"
              variant="outline"
              disabled={!selectedExerciseId || globalPending}
              onClick={() => void addExistingExercise()}
            >
              Agregar a la sesión
            </Button>
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Crear un ejercicio nuevo
              </summary>
              <div className="mt-3">
                <SessionCreateExerciseForm
                  sessionId={detail.session.id}
                  muscleGroups={[...MUSCLE_GROUPS]}
                />
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Ejercicios</h2>
        {detail.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta sesión no tiene ejercicios.</p>
        ) : (
          detail.exercises.map((exercise) => {
            const payload = currentPayloads[exercise.id];
            const status = statuses[exercise.id];
            const dirty = dirtyIds.has(exercise.id);
            const completedCount = payload.sets.filter((set) => set.is_completed).length;
            return (
              <Card key={exercise.id}>
                <CardHeader className="space-y-1 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {exercise.nombre_snapshot}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {exercise.muscle_group_label_snapshot ??
                          exercise.grupo_muscular_snapshot ??
                          "Sin grupo"}
                        {exercise.implement_snapshot
                          ? ` · ${exercise.implement_snapshot}`
                          : ""}
                        {exercise.weight_mode_snapshot
                          ? ` · ${exercise.weight_mode_snapshot}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full border px-2 py-1 text-xs">
                      {completedCount}/{payload.sets.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {staleDraftIds.has(exercise.id) ? (
                    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <p>
                        Hay un borrador de una versión anterior. No se aplicó para evitar
                        sobrescribir cambios de otro dispositivo.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => discardExerciseDraft(exercise.id)}
                      >
                        Descartar borrador viejo
                      </Button>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {payload.sets.map((set, setIndex) => (
                      <div key={set.set_number} className="space-y-2 rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              className="size-5"
                              checked={set.is_completed}
                              disabled={readOnly}
                              onChange={(event) =>
                                updateExercise(exercise.id, (current) =>
                                  renumberWorkoutPayload({
                                    ...current,
                                    sets: current.sets.map((currentSet, currentIndex) =>
                                      currentIndex === setIndex
                                        ? {
                                            ...currentSet,
                                            is_completed: event.target.checked,
                                          }
                                        : currentSet,
                                    ),
                                  }),
                                )
                              }
                            />
                            Serie {setIndex + 1}
                          </label>
                          <span className="text-xs text-muted-foreground">
                            Objetivo: {set.target_reps ?? "—"} reps ·{" "}
                            {set.target_weight_kg ?? "—"} kg
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`reps-${exercise.id}-${setIndex}`}>
                              Repeticiones
                            </Label>
                            <Input
                              id={`reps-${exercise.id}-${setIndex}`}
                              type="number"
                              min={0}
                              max={1000}
                              step={1}
                              inputMode="numeric"
                              readOnly={readOnly}
                              value={set.actual_reps ?? ""}
                              onChange={(event) =>
                                updateExercise(exercise.id, (current) => ({
                                  ...current,
                                  sets: current.sets.map((currentSet, currentIndex) =>
                                    currentIndex === setIndex
                                      ? {
                                          ...currentSet,
                                          actual_reps: nullableNumberFromInput(
                                            event.target.value,
                                          ),
                                        }
                                      : currentSet,
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`weight-${exercise.id}-${setIndex}`}>
                              Peso kg
                            </Label>
                            <Input
                              id={`weight-${exercise.id}-${setIndex}`}
                              type="number"
                              min={0}
                              max={9999.99}
                              step="0.5"
                              inputMode="decimal"
                              readOnly={readOnly}
                              value={set.actual_weight_kg ?? ""}
                              onChange={(event) =>
                                updateExercise(exercise.id, (current) => ({
                                  ...current,
                                  sets: current.sets.map((currentSet, currentIndex) =>
                                    currentIndex === setIndex
                                      ? {
                                          ...currentSet,
                                          actual_weight_kg: nullableNumberFromInput(
                                            event.target.value,
                                          ),
                                        }
                                      : currentSet,
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>
                        {!readOnly ? (
                          <Button
                            className="w-full"
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={payload.sets.length === 1}
                            onClick={() =>
                              updateExercise(exercise.id, (current) =>
                                renumberWorkoutPayload({
                                  ...current,
                                  sets: current.sets.filter(
                                    (_, currentIndex) => currentIndex !== setIndex,
                                  ),
                                }),
                              )
                            }
                          >
                            Quitar serie
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {!readOnly ? (
                    <Button
                      className="w-full"
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={payload.sets.length >= 50}
                      onClick={() =>
                        updateExercise(exercise.id, (current) => {
                          const previous = current.sets[current.sets.length - 1];
                          return renumberWorkoutPayload({
                            ...current,
                            sets: [
                              ...current.sets,
                              {
                                set_number: current.sets.length + 1,
                                target_reps: previous?.target_reps ?? null,
                                target_weight_kg: previous?.target_weight_kg ?? null,
                                actual_reps: previous?.actual_reps ?? null,
                                actual_weight_kg: previous?.actual_weight_kg ?? null,
                                is_completed: false,
                                notes: null,
                              },
                            ],
                          });
                        })
                      }
                    >
                      Agregar serie
                    </Button>
                  ) : null}

                  <div className="space-y-1">
                    <Label htmlFor={`decision-${exercise.id}`}>Próxima vez</Label>
                    <select
                      id={`decision-${exercise.id}`}
                      className="h-11 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                      value={payload.decision}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateExercise(exercise.id, (current) => ({
                          ...current,
                          decision: event.target.value as TrainingAdjustment,
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
                    <Label htmlFor={`exercise-notes-${exercise.id}`}>Notas</Label>
                    <textarea
                      id={`exercise-notes-${exercise.id}`}
                      className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                      value={payload.notes}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateExercise(exercise.id, (current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>

                  {exercise.routine_exercise_id && !readOnly ? (
                    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-5"
                        checked={payload.apply_to_routine}
                        onChange={(event) =>
                          updateExercise(exercise.id, (current) => ({
                            ...current,
                            apply_to_routine: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium">
                          Usar lo realizado como próximo objetivo
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Se aplica al finalizar. Está apagado por defecto para proteger la
                          rutina actual.
                        </span>
                      </span>
                    </label>
                  ) : null}

                  {!readOnly ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="h-11"
                        type="button"
                        disabled={!dirty || status?.pending}
                        onClick={() => void saveExercise(exercise.id)}
                      >
                        {status?.pending
                          ? "Guardando…"
                          : dirty
                            ? "Guardar ejercicio"
                            : "Guardado"}
                      </Button>
                      <Button
                        className="h-11"
                        type="button"
                        variant="outline"
                        disabled={!dirty || status?.pending}
                        onClick={() => discardExerciseDraft(exercise.id)}
                      >
                        Descartar
                      </Button>
                    </div>
                  ) : null}

                  {!readOnly ? (
                    <Button
                      className="h-11 w-full"
                      type="button"
                      variant="destructive"
                      disabled={status?.pending}
                      onClick={() =>
                        void removeExercise(exercise.id, exercise.nombre_snapshot)
                      }
                    >
                      Quitar de la sesión
                    </Button>
                  ) : null}

                  <div aria-live="polite">
                    {status?.saved ? (
                      <p className="text-sm text-emerald-600">Ejercicio guardado.</p>
                    ) : null}
                    {status?.error ? (
                      <p className="text-sm text-destructive">{status.error}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumen de la sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-4 disabled:opacity-80" disabled={readOnly}>
          <div className="space-y-1">
            <Label htmlFor="session-name">Nombre</Label>
            <Input
              id="session-name"
              value={metadata.session_name}
              readOnly={readOnly}
              onChange={(event) =>
                updateMetadata((current) => ({
                  ...current,
                  session_name: event.target.value,
                }))
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Energía 1–5</Label>
              {metadataInput(
                metadata.energy_level,
                (value) => updateMetadata((current) => ({ ...current, energy_level: value })),
                { min: 1, max: 5, label: "Energía" },
              )}
            </div>
            <div className="space-y-1">
              <Label>Rendimiento 1–5</Label>
              {metadataInput(
                metadata.performance_level,
                (value) =>
                  updateMetadata((current) => ({ ...current, performance_level: value })),
                { min: 1, max: 5, label: "Rendimiento" },
              )}
            </div>
            <div className="space-y-1">
              <Label>Dolor 0–10</Label>
              {metadataInput(
                metadata.pain_level,
                (value) => updateMetadata((current) => ({ ...current, pain_level: value })),
                { min: 0, max: 10, label: "Dolor" },
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pain-note">Zona o detalle de dolor</Label>
            <Input
              id="pain-note"
              value={metadata.pain_note}
              readOnly={readOnly}
              onChange={(event) =>
                updateMetadata((current) => ({ ...current, pain_note: event.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={metadata.abs_completed}
              disabled={readOnly}
              onChange={(event) =>
                updateMetadata((current) => ({
                  ...current,
                  abs_completed: event.target.checked,
                }))
              }
            />
            <span className="font-medium">Hice abdominales</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Minutos de cinta</Label>
              {metadataInput(
                metadata.treadmill_minutes,
                (value) =>
                  updateMetadata((current) => ({ ...current, treadmill_minutes: value })),
                { min: 0, max: 1440, step: 0.5, label: "Minutos de cinta" },
              )}
            </div>
            <div className="space-y-1">
              <Label>Distancia km</Label>
              {metadataInput(
                metadata.treadmill_distance_km,
                (value) =>
                  updateMetadata((current) => ({
                    ...current,
                    treadmill_distance_km: value,
                  })),
                { min: 0, max: 1000, step: 0.01, label: "Distancia de cinta" },
              )}
            </div>
            <div className="space-y-1">
              <Label>Velocidad km/h</Label>
              {metadataInput(
                metadata.treadmill_speed_kmh,
                (value) =>
                  updateMetadata((current) => ({ ...current, treadmill_speed_kmh: value })),
                { min: 0, max: 100, step: 0.1, label: "Velocidad de cinta" },
              )}
            </div>
            <div className="space-y-1">
              <Label>Inclinación %</Label>
              {metadataInput(
                metadata.treadmill_incline_percent,
                (value) =>
                  updateMetadata((current) => ({
                    ...current,
                    treadmill_incline_percent: value,
                  })),
                { min: 0, max: 100, step: 0.5, label: "Inclinación de cinta" },
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="session-notes">Notas generales</Label>
            <textarea
              id="session-notes"
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={metadata.notes}
              disabled={readOnly}
              onChange={(event) =>
                updateMetadata((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </div>
          {!readOnly && metadataDirty ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Este resumen se guarda al finalizar.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setMetadataOverride(null);
                  removeDraft(metadataKey);
                }}
              >
                Descartar
              </Button>
            </div>
          ) : null}
          </fieldset>
        </CardContent>
      </Card>

      {!readOnly ? (
        <div className="space-y-3">
          <Button
            className="h-12 w-full"
            type="button"
            disabled={globalPending || dirtyIds.size > 0 || stats.completedSets === 0}
            onClick={() => void finishSession()}
          >
            {globalPending ? "Procesando…" : "Finalizar sesión"}
          </Button>
          <Button
            className="h-11 w-full"
            type="button"
            variant="destructive"
            disabled={globalPending}
            onClick={() => void cancelSession()}
          >
            Cancelar borrador de sesión
          </Button>
          <p className="text-xs text-muted-foreground">
            Finalizar aplica a la rutina únicamente los ejercicios donde activaste
            “Usar lo realizado como próximo objetivo”.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          Sesión finalizada. El historial está en modo lectura.
        </div>
      )}

      <div aria-live="polite">
        {globalError ? <p className="text-sm text-destructive">{globalError}</p> : null}
      </div>

      <Link
        href="/train"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
        onClick={confirmNavigation}
      >
        Volver a Entrenar
      </Link>
    </div>
  );
}
