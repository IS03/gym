"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Clock3, Minus, Plus, Search, X } from "lucide-react";
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
  completedExerciseSummary,
  completionStats,
  exerciseCompletion,
  initialExpandedExerciseId,
  formatWorkoutClockTime,
  formatWorkoutDuration,
  formatWorkoutTimeRange,
  getWorkoutElapsedMilliseconds,
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
  readOnly: boolean;
  onChange: (updater: (set: EditableWorkoutSet) => EditableWorkoutSet) => void;
};

const SET_GRID_COLUMNS =
  "grid-cols-[2rem_minmax(0,1fr)_3.75rem_2.25rem_2.75rem]";

function compactNumber(value: number | null) {
  return value === null ? "—" : String(value).replace(".", ",");
}

function timerLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function validRestSeconds(value: number | null) {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function configuredRestLabel(minimum: number | null, maximum: number | null) {
  return formatRestRange(validRestSeconds(minimum), validRestSeconds(maximum));
}

function SessionTiming({
  startedAt,
  endedAt,
  isActive,
}: {
  startedAt: string | null;
  endedAt: string | null;
  isActive: boolean;
}) {
  const startedAtMilliseconds = startedAt ? new Date(startedAt).getTime() : Number.NaN;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!isActive) return () => {};
      const refresh = () => onStoreChange();
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") refresh();
      };
      const interval = window.setInterval(refresh, 60_000);
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    },
    [isActive],
  );
  const getSnapshot = useCallback(() => Date.now(), []);
  const getServerSnapshot = useCallback(
    () => (Number.isFinite(startedAtMilliseconds) ? startedAtMilliseconds : 0),
    [startedAtMilliseconds],
  );
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const startedClock = formatWorkoutClockTime(startedAt);

  if (!startedClock) return null;

  if (isActive) {
    const duration = formatWorkoutDuration(
      getWorkoutElapsedMilliseconds(startedAt, new Date(now).toISOString()),
    );
    return duration ? (
      <p className="metric-number text-xs text-muted-foreground">
        Iniciada {startedClock} · {duration}
      </p>
    ) : null;
  }

  const range = formatWorkoutTimeRange(startedAt, endedAt);
  const duration = formatWorkoutDuration(getWorkoutElapsedMilliseconds(startedAt, endedAt));
  return range && duration ? (
    <p className="metric-number text-xs text-muted-foreground">
      {range} · {duration}
    </p>
  ) : (
    <p className="metric-number text-xs text-muted-foreground">
      Iniciada {startedClock}
    </p>
  );
}

function SetRow({
  exerciseId,
  set,
  setIndex,
  readOnly,
  onChange,
}: SetRowProps) {
  return (
    <div
      className={cn(
        "grid items-center gap-x-1.5 border-b border-border/60 px-1 py-2.5 transition-colors duration-150 last:border-b-0",
        SET_GRID_COLUMNS,
        set.is_completed
          ? "bg-emerald-500/[0.06]"
          : "bg-transparent",
      )}
    >
      <span className="metric-number text-center text-sm font-semibold text-muted-foreground">
        {setIndex + 1}
      </span>
      <div className="min-w-0 space-y-0.5">
        <Input
          aria-label={`Peso de la serie ${setIndex + 1} de ${exerciseId}`}
          className="metric-number h-10 px-1 text-center text-base font-semibold"
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
        <p className="metric-number truncate text-center text-[10px] leading-none text-muted-foreground">
          obj {compactNumber(set.target_weight_kg)}
        </p>
      </div>
      <div className="min-w-0 space-y-0.5">
        <Input
          aria-label={`Repeticiones de la serie ${setIndex + 1} de ${exerciseId}`}
          className="metric-number h-10 px-1 text-center text-base font-semibold"
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
        <p className="metric-number truncate text-center text-[10px] leading-none text-muted-foreground">
          obj {compactNumber(set.target_reps)}
        </p>
      </div>
      <span
        className="metric-number text-center text-sm font-semibold"
        aria-label={`RIR objetivo de la serie ${setIndex + 1}: ${set.target_rir ?? "sin definir"}`}
      >
        {compactNumber(set.target_rir)}
      </span>
      {readOnly ? (
        <span
          className="flex size-11 items-center justify-center rounded-full"
          aria-label={set.is_completed ? "Serie completada" : "Serie pendiente"}
        >
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border",
              set.is_completed
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border bg-transparent text-muted-foreground",
            )}
          >
            {set.is_completed ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
          </span>
        </span>
      ) : (
        <button
          type="button"
          className="group flex size-11 touch-manipulation items-center justify-center rounded-full outline-none transition-transform duration-150 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Marcar serie ${setIndex + 1} como ${set.is_completed ? "pendiente" : "completada"}`}
          aria-pressed={set.is_completed}
          onClick={() =>
            onChange((current) => ({
              ...current,
              is_completed: !current.is_completed,
            }))
          }
        >
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-150 group-active:scale-95",
              set.is_completed
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-border bg-transparent text-muted-foreground group-hover:border-primary/50",
            )}
          >
            {set.is_completed ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
          </span>
        </button>
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
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(() =>
    initialExpandedExerciseId(
      detail.exercises.map((exercise) => ({
        id: exercise.id,
        payload: currentPayloads[exercise.id],
      })),
    ),
  );
  const appliedHydratedFocus = useRef(false);

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
  const progressPercent =
    stats.totalSets === 0 ? 0 : Math.round((stats.completedSets / stats.totalSets) * 100);
  const hasUnsavedWork = dirtyIds.size > 0 || metadataDirty;
  const restRemaining = restTimer
    ? Math.max(0, Math.ceil((restTimer.endAt - timerNow) / 1000))
    : 0;

  useEffect(() => {
    if (appliedHydratedFocus.current) return;
    appliedHydratedFocus.current = true;

    const storedDrafts = snapshotRecord(getDraftSnapshot(draftKeys));
    const hydratedExercises = detail.exercises.map((exercise) => {
      const draft = readOnly
        ? null
        : parseWorkoutExerciseDraft(
            storedDrafts[workoutDraftKey(detail.session.id, exercise.id)] ?? null,
            exercise.id,
          );
      return {
        id: exercise.id,
        payload:
          draft?.serverUpdatedAt === serverVersions[exercise.id]
            ? draft.payload
            : serverPayloads[exercise.id],
      };
    });
    setExpandedExerciseId(initialExpandedExerciseId(hydratedExercises));
  }, [detail.exercises, detail.session.id, draftKeys, readOnly, serverPayloads, serverVersions]);

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
      validRestSeconds(exercise.rest_max_seconds_snapshot) ??
      validRestSeconds(exercise.rest_min_seconds_snapshot);
    if (seconds === null) return;
    const now = Date.now();
    setTimerNow(now);
    setRestTimer({
      exerciseName: exercise.nombre_snapshot,
      endAt: now + seconds * 1000,
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
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {detail.session.session_name ??
                detail.session.routine_name_snapshot ??
                "Sesión libre"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{detail.logDate}</p>
          </div>
          {!readOnly && (dirtyIds.size > 0 || metadataDirty) ? (
            <span className="mt-1 shrink-0 rounded-full bg-amber-500/12 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              {dirtyIds.size + (metadataDirty ? 1 : 0)} sin guardar
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              <span className="metric-number font-semibold text-foreground">
                {stats.completedSets}
              </span>{" "}
              de {stats.totalSets} series · {stats.completedExercises} de{" "}
              {detail.exercises.length} ejercicios
            </span>
            <span className="metric-number shrink-0 font-medium text-foreground">
              {progressPercent}%
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progreso del entrenamiento"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <SessionTiming
          startedAt={detail.session.started_at}
          endedAt={detail.session.ended_at}
          isActive={!readOnly}
        />
      </header>

      {storageError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          El navegador no permitió guardar el borrador local. No cierres esta pestaña hasta
          guardar los ejercicios.
        </div>
      ) : null}

      {!readOnly && exercisePickerOpen ? (
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

      <section className="space-y-3">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Ejercicios</h2>
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setExercisePickerOpen(true)}
            >
              <Plus className="size-4" aria-hidden />
              Agregar
            </Button>
          ) : null}
        </div>
        {detail.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta sesión no tiene ejercicios.</p>
        ) : (
          detail.exercises.map((exercise) => {
            const payload = currentPayloads[exercise.id];
            const status = statuses[exercise.id];
            const dirty = dirtyIds.has(exercise.id);
            const completion = exerciseCompletion(payload);
            const expanded = expandedExerciseId === exercise.id;
            const completedSummary = completedExerciseSummary(payload);
            const restLabel = configuredRestLabel(
              exercise.rest_min_seconds_snapshot,
              exercise.rest_max_seconds_snapshot,
            );
            const exerciseContentId = `session-exercise-${exercise.id}`;
            const exerciseMeta = [
              exercise.muscle_group_label_snapshot ??
                exercise.grupo_muscular_snapshot ??
                "Sin grupo",
              exercise.implement_snapshot,
              exercise.weight_mode_snapshot,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Card
                key={exercise.id}
                size="sm"
                className={cn(
                  "relative gap-0 overflow-hidden py-0 transition-[box-shadow] duration-200 motion-reduce:transition-none",
                  expanded && "shadow-md ring-primary/35",
                  completion.isComplete && !expanded && "ring-emerald-500/20",
                )}
              >
                {expanded ? (
                  <span
                    className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary"
                    aria-hidden
                  />
                ) : null}
                <CardHeader className="p-0">
                  <button
                    type="button"
                    className="flex min-h-[4.25rem] w-full touch-manipulation items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-muted/40 active:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                    aria-expanded={expanded}
                    aria-controls={exerciseContentId}
                    onClick={() => setExpandedExerciseId(expanded ? null : exercise.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {completion.isComplete ? (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Check className="size-3" strokeWidth={3} aria-hidden />
                          </span>
                        ) : null}
                        <h3 className="truncate text-sm font-semibold tracking-tight">
                          {exercise.nombre_snapshot}
                        </h3>
                        {dirty ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-amber-500"
                            aria-label="Cambios sin guardar"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {!expanded && completion.isComplete && completedSummary
                          ? completedSummary
                          : exerciseMeta}
                      </p>
                      {staleDraftIds.has(exercise.id) ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Borrador anterior sin aplicar
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "metric-number shrink-0 rounded-full border px-2 py-1 text-xs font-medium",
                        completion.isComplete &&
                          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {completion.completedSets}/{completion.totalSets}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </CardHeader>
                {expanded ? (
                  <CardContent
                    id={exerciseContentId}
                    className="space-y-3 border-t border-border/70 px-3 pb-3 pt-3"
                  >
                  {staleDraftIds.has(exercise.id) ? (
                    <div className="space-y-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm">
                      <p className="text-xs leading-relaxed">
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

                  <div className="overflow-hidden rounded-xl border border-border/75 bg-background/35">
                    <div
                      className={cn(
                        "grid gap-x-1.5 border-b border-border/60 bg-muted/35 px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                        SET_GRID_COLUMNS,
                      )}
                    >
                      <span className="text-center">Serie</span>
                      <span className="text-center">kg</span>
                      <span className="text-center">reps</span>
                      <span className="text-center">RIR</span>
                      <span className="text-center" aria-label="Completada">✓</span>
                    </div>
                    {payload.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.set_number}
                        exerciseId={exercise.id}
                        set={set}
                        setIndex={setIndex}
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
                      />
                    ))}
                  </div>

                  {restLabel ? (
                    <div className="flex min-h-9 items-center justify-between gap-3 px-1">
                      <p className="text-xs text-muted-foreground">
                        Descanso{" "}
                        <span className="metric-number font-semibold text-foreground">
                          {restLabel}
                        </span>
                      </p>
                      {!readOnly ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => startRestTimer(exercise)}
                          aria-label={`Iniciar temporizador de descanso para ${exercise.nombre_snapshot}`}
                        >
                          <Clock3 className="size-3.5" aria-hidden />
                          Iniciar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {!readOnly ? (
                    <Button
                      className="h-9"
                      type="button"
                      size="sm"
                      variant="ghost"
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
                      <Plus className="size-3.5" aria-hidden />
                      Agregar serie
                    </Button>
                  ) : null}

                  {!readOnly ? (
                    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <div className="min-w-0" aria-live="polite">
                        <p
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium",
                            dirty || status?.pending
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {dirty || status?.pending ? (
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                          ) : (
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                          )}
                          {status?.pending
                            ? "Guardando…"
                            : dirty
                              ? "Cambios sin guardar"
                              : "Guardado"}
                        </p>
                        {status?.error ? (
                          <p className="mt-1 text-xs leading-snug text-destructive">
                            {status.error}
                          </p>
                        ) : null}
                      </div>
                      {dirty || status?.pending ? (
                        <Button
                          className="shrink-0"
                          type="button"
                          size="sm"
                          disabled={status?.pending}
                          onClick={() => void saveExercise(exercise.id)}
                        >
                          {status?.pending ? "Guardando…" : "Guardar"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <details className="group rounded-xl border border-border/75 bg-muted/15">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2">
                        <span>Progresión y próxima vez</span>
                        {payload.notes || payload.decision_note || payload.apply_to_routine ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Tiene configuración adicional" />
                        ) : null}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                    </summary>
                    <div className="space-y-4 border-t border-border/60 p-3">
                      <div className="space-y-2">
                        <Label>¿Qué hacer la próxima sesión?</Label>
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

                      {payload.decision === "custom" || payload.decision_note ? (
                        <div className="space-y-1.5">
                          <Label htmlFor={`decision-note-${exercise.id}`}>
                            Indicación para la próxima vez
                          </Label>
                          <textarea
                            id={`decision-note-${exercise.id}`}
                            className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                            value={payload.decision_note}
                            disabled={readOnly}
                            placeholder="Ejemplo: probar 37,5 kg solo en la primera serie"
                            onChange={(event) =>
                              updateExercise(exercise.id, (current) => ({
                                ...current,
                                decision_note: event.target.value,
                              }))
                            }
                          />
                        </div>
                      ) : null}

                      {exercise.routine_exercise_id ? (
                        <label className="flex items-start gap-3 rounded-xl border border-border/75 bg-background/45 p-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0"
                            checked={payload.apply_to_routine}
                            disabled={readOnly}
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
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              Se aplica al finalizar y solo toma las series completadas.
                            </span>
                          </span>
                        </label>
                      ) : null}

                      <div className="space-y-1.5">
                        <Label htmlFor={`exercise-notes-${exercise.id}`}>
                          Nota del ejercicio
                        </Label>
                        <textarea
                          id={`exercise-notes-${exercise.id}`}
                          aria-label={`Nota para ${exercise.nombre_snapshot}`}
                          className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                          value={payload.notes}
                          disabled={readOnly}
                          placeholder="Opcional"
                          onChange={(event) =>
                            updateExercise(exercise.id, (current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </details>

                  {!readOnly ? (
                    <details className="group rounded-xl border border-transparent">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                        Más opciones del ejercicio
                        <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                      </summary>
                      <div className="grid gap-2 px-3 pb-3 pt-1 sm:grid-cols-2">
                        {dirty ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={status?.pending}
                            onClick={() => discardExerciseDraft(exercise.id)}
                          >
                            Descartar cambios
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={status?.pending}
                          onClick={() => void removeExercise(exercise.id, exercise.nombre_snapshot)}
                        >
                          Quitar de la sesión
                        </Button>
                      </div>
                    </details>
                  ) : null}
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      <Card size="sm" className="gap-0 py-0">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <CardTitle className="text-sm">Resumen de la sesión</CardTitle>
              {metadataDirty ? (
                <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Resumen con cambios" />
              ) : null}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <CardContent className="border-t border-border/70 px-3 pb-3 pt-4">
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
        </details>
      </Card>

      {!readOnly ? (
        <div className="space-y-3">
          <Button
            className="h-12 w-full"
            type="button"
            disabled={globalPending || dirtyIds.size > 0 || stats.completedSets === 0}
            onClick={() => void finishSession()}
          >
            {globalPending ? "Procesando…" : "Finalizar entrenamiento"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {dirtyIds.size > 0
              ? `Guardá o descartá ${dirtyIds.size === 1 ? "el ejercicio pendiente" : `los ${dirtyIds.size} ejercicios pendientes`} para finalizar.`
              : "Solo se actualiza la rutina donde activaste “Usar lo realizado como próximo objetivo”."}
          </p>
          <div aria-live="polite">
            {globalError ? <p className="text-sm text-destructive">{globalError}</p> : null}
          </div>
          <details className="group rounded-xl border border-transparent">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              Más opciones
              <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="px-3 pb-3 pt-1">
              <Button
                className="w-full"
                type="button"
                size="sm"
                variant="destructive"
                disabled={globalPending}
                onClick={() => void cancelSession()}
              >
                Cancelar entrenamiento
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Elimina solo esta sesión en curso; no toca la rutina ni el historial.
              </p>
            </div>
          </details>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          Sesión finalizada. El historial está en modo lectura.
        </div>
      )}

      {readOnly && globalError ? (
        <div aria-live="polite">
          <p className="text-sm text-destructive">{globalError}</p>
        </div>
      ) : null}

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
