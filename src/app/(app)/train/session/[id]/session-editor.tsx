"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Clock3, Ellipsis, Minus, Plus, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  filterExercisesByMuscleGroup,
  MUSCLE_GROUP_OPTIONS,
  type MuscleGroupFilter,
} from "@/lib/phase2/muscle-groups";
import { formatRestRange } from "@/lib/phase2/training-display";
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
  MuscleGroup,
  TrainingAdjustment,
  EditableWorkoutSet,
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

type ExerciseStatus = {
  pending: boolean;
  saved: boolean;
  error: string | null;
};

type RestTimerState = {
  exerciseName: string;
  endAt: number;
};

type SetRowProps = {
  exerciseId: string;
  set: EditableWorkoutSet;
  setIndex: number;
  setCount: number;
  readOnly: boolean;
  onChange: (updater: (set: EditableWorkoutSet) => EditableWorkoutSet) => void;
  onCompleted: (completed: boolean) => void;
  onRemove: () => void;
};

function compactNumber(value: number | null) {
  return value === null ? "—" : String(value).replace(".", ",");
}

function timerLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function SetRow({
  exerciseId,
  set,
  setIndex,
  setCount,
  readOnly,
  onChange,
  onCompleted,
  onRemove,
}: SetRowProps) {
  const target = `${compactNumber(set.target_reps)} × ${compactNumber(set.target_weight_kg)} kg`;

  return (
    <div
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)_4.25rem_4rem_2.75rem] items-center gap-1.5 rounded-xl border px-2 py-2 transition-[background-color,border-color] duration-150",
        set.is_completed
          ? "border-emerald-500/25 bg-emerald-500/8"
          : "border-border/80 bg-background/40",
      )}
    >
      <span className="metric-number text-center text-sm font-semibold text-muted-foreground">
        {setIndex + 1}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{target}</p>
        {set.target_rir !== null ? (
          <p className="text-[11px] text-muted-foreground">RIR {set.target_rir}</p>
        ) : null}
      </div>
      <Input
        aria-label={`Peso de la serie ${setIndex + 1} de ${exerciseId}`}
        className="metric-number h-10 px-1 text-center text-sm font-semibold"
        type="number"
        min={0}
        max={9999.99}
        step="0.5"
        inputMode="decimal"
        readOnly={readOnly}
        value={set.actual_weight_kg ?? ""}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            actual_weight_kg: nullableNumberFromInput(event.target.value),
          }))
        }
      />
      <Input
        aria-label={`Repeticiones de la serie ${setIndex + 1} de ${exerciseId}`}
        className="metric-number h-10 px-1 text-center text-sm font-semibold"
        type="number"
        min={0}
        max={1000}
        step={1}
        inputMode="numeric"
        readOnly={readOnly}
        value={set.actual_reps ?? ""}
        onChange={(event) =>
          onChange((current) => ({
            ...current,
            actual_reps: nullableNumberFromInput(event.target.value),
          }))
        }
      />
      {readOnly ? (
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            set.is_completed ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
          )}
          aria-label={set.is_completed ? "Serie completada" : "Serie pendiente"}
        >
          {set.is_completed ? <Check className="size-5" aria-hidden /> : "—"}
        </span>
      ) : (
        <div className="relative flex size-11 items-center justify-center">
          <button
            type="button"
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border transition-[background-color,border-color,transform] duration-150 active:scale-95",
              set.is_completed
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border bg-background text-muted-foreground hover:border-primary/50",
            )}
            aria-label={`Marcar serie ${setIndex + 1} como ${set.is_completed ? "pendiente" : "completada"}`}
            aria-pressed={set.is_completed}
            onClick={() => {
              const next = !set.is_completed;
              onChange((current) => ({ ...current, is_completed: next }));
              onCompleted(next);
            }}
          >
            {set.is_completed ? <Check className="size-5" aria-hidden /> : null}
          </button>
          {setCount > 1 ? (
            <button
              type="button"
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm"
              aria-label={`Quitar serie ${setIndex + 1}`}
              onClick={onRemove}
            >
              <Ellipsis className="size-3" aria-hidden />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

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
  libraryExercises: Array<{
    id: string;
    nombre: string;
    grupo_muscular: MuscleGroup | null;
  }>;
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
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroupFilter>("all");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [collapsedExercises, setCollapsedExercises] = useState<Record<string, boolean>>({});
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const sessionExerciseLibraryIds = useMemo(
    () => new Set(detail.exercises.map((exercise) => exercise.exercise_id)),
    [detail.exercises],
  );
  const filteredLibraryExercises = useMemo(
    () =>
      filterExercisesByMuscleGroup(libraryExercises, selectedMuscleGroup).filter(
        (exercise) =>
          !sessionExerciseLibraryIds.has(exercise.id) &&
          exercise.nombre.toLocaleLowerCase("es").includes(exerciseSearch.trim().toLocaleLowerCase("es")),
      ),
    [exerciseSearch, libraryExercises, selectedMuscleGroup, sessionExerciseLibraryIds],
  );
  const activeSelectedExerciseId = filteredLibraryExercises.some(
    (exercise) => exercise.id === selectedExerciseId,
  )
    ? selectedExerciseId
    : (filteredLibraryExercises[0]?.id ?? "");

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
  const restRemaining = restTimer
    ? Math.max(0, Math.ceil((restTimer.endAt - timerNow) / 1000))
    : 0;

  useEffect(() => {
    if (!restTimer) return;
    setTimerNow(Date.now());
    const interval = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [restTimer]);

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

  function startRestTimer(exercise: WorkoutSessionClientDetail["exercises"][number]) {
    const seconds =
      exercise.rest_max_seconds_snapshot ?? exercise.rest_min_seconds_snapshot ?? null;
    if (!seconds || seconds <= 0) return;
    setRestTimer({
      exerciseName: exercise.nombre_snapshot,
      endAt: Date.now() + seconds * 1000,
    });
  }

  function updateRestTimer(seconds: number) {
    setRestTimer((current) =>
      current
        ? { ...current, endAt: Math.max(Date.now(), current.endAt + seconds * 1000) }
        : current,
    );
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
    if (!activeSelectedExerciseId) return;
    setGlobalPending(true);
    setGlobalError(null);
    const result = await appendWorkoutExerciseAction({
      sessionId: detail.session.id,
      exerciseId: activeSelectedExerciseId,
    });
    setGlobalPending(false);
    if (!result.ok) {
      setGlobalError(result.error);
      return;
    }
    setExercisePickerOpen(false);
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
        <>
          <Button
            className="h-11 w-full"
            type="button"
            variant="outline"
            onClick={() => setExercisePickerOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Agregar ejercicio
          </Button>
          {exercisePickerOpen ? (
            <div
              className="fixed inset-0 z-[60] flex items-end bg-black/45 px-2 pt-12 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="extra-exercise-title"
            >
              <div className="max-h-[min(46rem,calc(100dvh-env(safe-area-inset-top)))] w-full rounded-t-[1.7rem] border border-border bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200">
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 id="extra-exercise-title" className="text-lg font-semibold tracking-tight">
                      Agregar ejercicio
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Los ejercicios de esta sesión no se pueden duplicar.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Cerrar selector de ejercicios"
                    onClick={() => setExercisePickerOpen(false)}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    aria-label="Buscar ejercicio"
                    className="pl-9"
                    value={exerciseSearch}
                    placeholder="Buscar ejercicio"
                    onChange={(event) => setExerciseSearch(event.target.value)}
                  />
                </div>
                <div className="my-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedMuscleGroup === "all" ? "default" : "outline"}
                    onClick={() => setSelectedMuscleGroup("all")}
                  >
                    Todos
                  </Button>
                  {MUSCLE_GROUP_OPTIONS.map((group) => (
                    <Button
                      key={group.value}
                      type="button"
                      size="sm"
                      variant={selectedMuscleGroup === group.value ? "default" : "outline"}
                      onClick={() => setSelectedMuscleGroup(group.value)}
                    >
                      {group.label}
                    </Button>
                  ))}
                </div>
                <div className="max-h-[42dvh] space-y-1 overflow-y-auto pb-3">
                  {filteredLibraryExercises.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      No hay ejercicios disponibles con ese filtro.
                    </p>
                  ) : (
                    filteredLibraryExercises.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        className={cn(
                          "flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left transition-colors",
                          activeSelectedExerciseId === exercise.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                        onClick={() => setSelectedExerciseId(exercise.id)}
                      >
                        <span className="font-medium">{exercise.nombre}</span>
                        <span className="text-xs opacity-70">{exercise.grupo_muscular ?? ""}</span>
                      </button>
                    ))
                  )}
                </div>
                <Button
                  className="h-12 w-full"
                  type="button"
                  disabled={!activeSelectedExerciseId || globalPending}
                  onClick={() => void addExistingExercise()}
                >
                  {globalPending ? "Agregando…" : "Agregar a la sesión"}
                </Button>
                <details className="mt-3 rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Crear ejercicio nuevo</summary>
                  <div className="mt-3">
                    <SessionCreateExerciseForm
                      sessionId={detail.session.id}
                      muscleGroups={[...MUSCLE_GROUP_OPTIONS]}
                    />
                  </div>
                </details>
              </div>
            </div>
          ) : null}
        </>
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
              <Card
                key={exercise.id}
                className={cn(
                  "transition-[opacity,box-shadow] duration-150",
                  completedCount === payload.sets.length && "border-emerald-500/25",
                )}
              >
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
                    <div className="flex items-center gap-1.5">
                      <span className={cn("metric-number rounded-full border px-2 py-1 text-xs", completedCount === payload.sets.length && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                        {completedCount}/{payload.sets.length}
                      </span>
                      {completedCount === payload.sets.length ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={collapsedExercises[exercise.id] ? "Mostrar ejercicio" : "Contraer ejercicio"}
                          onClick={() =>
                            setCollapsedExercises((current) => ({
                              ...current,
                              [exercise.id]: !current[exercise.id],
                            }))
                          }
                        >
                          <ChevronDown className={cn("size-4 transition-transform duration-150", collapsedExercises[exercise.id] && "-rotate-90")} aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                {collapsedExercises[exercise.id] ? null : (
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

                  {formatRestRange(
                    exercise.rest_min_seconds_snapshot,
                    exercise.rest_max_seconds_snapshot,
                  ) ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Descanso entre series</span>
                      <span className="font-medium">
                        {formatRestRange(
                          exercise.rest_min_seconds_snapshot,
                          exercise.rest_max_seconds_snapshot,
                        )}
                      </span>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="grid grid-cols-[2rem_minmax(0,1fr)_4.25rem_4rem_2.75rem] gap-1.5 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span>#</span><span>Objetivo</span><span className="text-center">kg</span><span className="text-center">reps</span><span className="text-center">hecha</span>
                    </div>
                    {payload.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.set_number}
                        exerciseId={exercise.id}
                        set={set}
                        setIndex={setIndex}
                        setCount={payload.sets.length}
                        readOnly={readOnly}
                        onChange={(updater) =>
                          updateExercise(exercise.id, (current) =>
                            renumberWorkoutPayload({
                              ...current,
                              sets: current.sets.map((currentSet, currentIndex) =>
                                currentIndex === setIndex ? updater(currentSet) : currentSet,
                              ),
                            }),
                          )
                        }
                        onCompleted={(completed) => {
                          if (completed) startRestTimer(exercise);
                        }}
                        onRemove={() =>
                          updateExercise(exercise.id, (current) =>
                            renumberWorkoutPayload({
                              ...current,
                              sets: current.sets.filter((_, currentIndex) => currentIndex !== setIndex),
                            }),
                          )
                        }
                      />
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
                                target_rir: previous?.target_rir ?? null,
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
                    <Label>Próxima vez</Label>
                    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Decisión para la próxima vez">
                      {ADJUSTMENTS.map((adjustment) => (
                        <Button
                          key={adjustment.value}
                          type="button"
                          size="sm"
                          variant={payload.decision === adjustment.value ? "secondary" : "outline"}
                          disabled={readOnly}
                          aria-pressed={payload.decision === adjustment.value}
                          onClick={() =>
                            updateExercise(exercise.id, (current) => ({
                              ...current,
                              decision: adjustment.value,
                            }))
                          }
                        >
                          {adjustment.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <details className="rounded-xl border border-border/80 px-3 py-2" open={payload.notes ? true : undefined}>
                    <summary className="cursor-pointer text-sm font-medium">
                      {payload.notes ? "Nota" : "Añadir nota"}
                    </summary>
                    <textarea
                      id={`exercise-notes-${exercise.id}`}
                      aria-label={`Nota para ${exercise.nombre_snapshot}`}
                      className="mt-2 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                      value={payload.notes}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateExercise(exercise.id, (current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </details>

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
                    <details className="rounded-xl border border-destructive/20 px-3 py-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">Más acciones</summary>
                      <Button
                        className="mt-2 h-10 w-full"
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={status?.pending}
                        onClick={() => void removeExercise(exercise.id, exercise.nombre_snapshot)}
                      >
                        Quitar de la sesión
                      </Button>
                    </details>
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
                )}
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
          <details open={readOnly || metadataDirty ? true : undefined}>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Energía, rendimiento, cinta y notas
            </summary>
          <fieldset className="mt-4 space-y-4 disabled:opacity-80" disabled={readOnly}>
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
          </details>
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

      {restTimer && !readOnly ? (
        <aside
          className="fixed inset-x-3 bottom-[calc(5.35rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[406px] rounded-2xl border border-orange-400/25 bg-card/85 px-3 py-2.5 shadow-xl shadow-black/15 backdrop-blur-xl"
          aria-live="polite"
          aria-label="Temporizador de descanso"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
                <Clock3 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">Descanso · {restTimer.exerciseName}</p>
                <p className="metric-number text-lg font-semibold tracking-tight text-orange-500">
                  {restRemaining > 0 ? timerLabel(restRemaining) : "Listo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Restar 15 segundos" onClick={() => updateRestTimer(-15)}>
                <Minus aria-hidden />
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Sumar 15 segundos" onClick={() => updateRestTimer(15)}>
                <Plus aria-hidden />
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRestTimer(null)}>
                Saltar
              </Button>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
