"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Info,
  LoaderCircle,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocalizedDecimalInput } from "@/components/ui/localized-decimal-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import {
  filterExercisesByMuscleGroup,
  MUSCLE_GROUP_OPTIONS,
  type MuscleGroupFilter,
} from "@/lib/phase2/muscle-groups";
import { formatRestRange } from "@/lib/phase2/training-display";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import { formatSessionDate } from "@/lib/phase2/session-history";
import {
  appendWorkoutExerciseAction,
  cancelWorkoutSessionAction,
  finishWorkoutSessionAction,
  getWorkoutExerciseSyncStateAction,
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
import {
  ExerciseAutosaveError,
  ExerciseAutosaveQueue,
} from "@/lib/phase2/exercise-autosave";
import type { ExerciseAutosaveErrorCategory } from "@/lib/phase2/exercise-autosave";
import type {
  SessionMetadataInput,
  MuscleGroup,
  EditableWorkoutSet,
  WorkoutExercisePayload,
  WorkoutSessionClientDetail,
} from "@/lib/phase2/types";
import {
  calculateScrollCompensation,
  compactAutosaveStatus,
  completionStats,
  exerciseCompletion,
  exerciseProgressLabel,
  initialExpandedExerciseId,
  formatWorkoutClockTime,
  formatWorkoutDuration,
  formatWorkoutTimeRange,
  getWorkoutElapsedMilliseconds,
  hasFutureExerciseAction,
  nextSessionReminder,
  renumberWorkoutPayload,
  sessionHasCardioExercise,
  sessionMetadataFromSession,
  toggleTrainingDecision,
  workoutPayloadFromDetail,
  type SelectableTrainingDecision,
} from "./session-editor-helpers";
import { AddExerciseSheet } from "./add-exercise-sheet";
import { CompletedSessionActions } from "./completed-session-actions";
import { WorkoutFinishedDialog } from "./workout-finished-dialog";

const NEXT_SESSION_DECISIONS: Array<{
  value: SelectableTrainingDecision;
  label: string;
}> = [
  { value: "increase_weight", label: "+ Peso" },
  { value: "increase_reps", label: "+ Repeticiones" },
];

type ExerciseStatus = {
  pending: boolean;
  saved: boolean;
  error: string | null;
  errorCategory?: ExerciseAutosaveErrorCategory | null;
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
  onChange: (
    updater: (set: EditableWorkoutSet) => EditableWorkoutSet,
    options?: { immediate?: boolean },
  ) => void;
};

const SET_GRID_LAYOUT =
  "grid-cols-[2rem_minmax(0,1fr)_3.75rem_2.5rem_2.75rem]";
const SET_GRID_SHARED = `grid ${SET_GRID_LAYOUT} gap-x-1 px-1`;
const FINISH_CONFIRMATION_KEY_PREFIX = "ownlevel:workout-finished:";
const EXERCISE_AUTOSAVE_DEBOUNCE_MS = 850;

function finishConfirmationKey(sessionId: string) {
  return `${FINISH_CONFIRMATION_KEY_PREFIX}${sessionId}`;
}

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
        SET_GRID_SHARED,
        "items-center border-b border-border/60 py-2.5 transition-colors duration-150 last:border-b-0",
        set.is_completed
          ? "bg-emerald-500/[0.06]"
          : "bg-transparent",
      )}
    >
      <div className="flex min-w-0 items-center justify-center">
        <span className="metric-number text-sm font-semibold text-muted-foreground">
          {setIndex + 1}
        </span>
      </div>
      <div className="min-w-0 space-y-0.5">
        <LocalizedDecimalInput
          aria-label={`Peso de la serie ${setIndex + 1} de ${exerciseId}`}
          className="metric-number h-10 px-1 text-center text-base font-semibold"
          min={0}
          max={9999.99}
          readOnly={readOnly}
          value={set.actual_weight_kg}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              actual_weight_kg: value,
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
      <div className="flex min-w-0 items-center justify-center">
        <span
          className="metric-number text-sm font-semibold"
          aria-label={`RIR objetivo de la serie ${setIndex + 1}: ${set.target_rir ?? "sin definir"}`}
        >
          {compactNumber(set.target_rir)}
        </span>
      </div>
      {readOnly ? (
        <div
          className="flex min-w-0 items-center justify-center"
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
        </div>
      ) : (
        <button
          type="button"
          className="group flex size-11 min-w-0 touch-manipulation justify-self-center items-center justify-center rounded-full outline-none transition-transform duration-150 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={`Marcar serie ${setIndex + 1} como ${set.is_completed ? "pendiente" : "completada"}`}
          aria-pressed={set.is_completed}
          onClick={() =>
            onChange(
              (current) => ({
                ...current,
                is_completed: !current.is_completed,
              }),
              { immediate: true },
            )
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
  if (props.step && props.step !== 1) {
    return (
      <LocalizedDecimalInput
        aria-label={props.label}
        min={props.min}
        max={props.max}
        value={value}
        onValueChange={onChange}
      />
    );
  }
  return (
    <Input
      aria-label={props.label}
      type="number"
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      inputMode="numeric"
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
    muscle_group_label: string | null;
    implement: string | null;
    weight_mode: string | null;
  }>;
}) {
  const router = useRouter();
  const readOnly = detail.session.status !== "in_progress";
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
  const mountedRef = useRef(true);
  const exerciseCardRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingScrollAnchorRef = useRef<{
    exerciseId: string;
    beforeTop: number;
  } | null>(null);
  const editingFencedRef = useRef(false);
  const removingExerciseIdsRef = useRef(new Set<string>());
  const serverPayloadsRef = useRef(initialPayloads);
  const serverVersionsRef = useRef(initialVersions);
  const latestPayloadsRef = useRef(initialPayloads);
  const [storageError, setStorageError] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalPending, setGlobalPending] = useState(false);
  const [finishStage, setFinishStage] = useState<"saving" | "finishing" | null>(null);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroupFilter>("all");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [editingNoteExerciseId, setEditingNoteExerciseId] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const autosaveRef = useRef<ExerciseAutosaveQueue<WorkoutExercisePayload> | null>(null);
  if (autosaveRef.current === null) {
    autosaveRef.current = new ExerciseAutosaveQueue<WorkoutExercisePayload>({
      debounceMs: EXERCISE_AUTOSAVE_DEBOUNCE_MS,
      equals: payloadsEqual,
      save: async ({ exerciseId, payload, expectedUpdatedAt }) => {
        const result = await saveWorkoutExerciseAction({
          sessionId: detail.session.id,
          sessionExerciseId: exerciseId,
          expectedUpdatedAt,
          payload,
        });
        if (!result.ok) {
          throw new ExerciseAutosaveError(result.errorCategory, result.error);
        }
        return result.data;
      },
      loadServerState: async (exerciseId) => {
        const result = await getWorkoutExerciseSyncStateAction({
          sessionId: detail.session.id,
          sessionExerciseId: exerciseId,
        });
        if (!result.ok) throw new Error(result.error);
        return result.data;
      },
      onStateChange: (exerciseId, state) => {
        if (!mountedRef.current) return;
        setStatuses((current) => ({
          ...current,
          [exerciseId]: {
            pending: state.phase === "saving",
            saved: state.phase === "saved",
            error: state.error,
            errorCategory: state.errorCategory,
          },
        }));
      },
      onServerState: (exerciseId, state) => {
        if (state.status !== "active") {
          if (mountedRef.current) {
            setGlobalError(
              state.status === "session_closed"
                ? "La sesión ya fue finalizada en otra pestaña."
                : "Este ejercicio ya no está en la sesión.",
            );
          }
          return;
        }
        serverPayloadsRef.current = {
          ...serverPayloadsRef.current,
          [exerciseId]: state.payload,
        };
        serverVersionsRef.current = {
          ...serverVersionsRef.current,
          [exerciseId]: state.updatedAt,
        };
        if (!mountedRef.current) return;
        setServerPayloads((current) => ({ ...current, [exerciseId]: state.payload }));
        setServerVersions((current) => ({ ...current, [exerciseId]: state.updatedAt }));
      },
      onSaved: (
        exerciseId,
        { savedPayload, latestPayload, updatedAt, hasNewerChanges },
      ) => {
        serverPayloadsRef.current = {
          ...serverPayloadsRef.current,
          [exerciseId]: savedPayload,
        };
        serverVersionsRef.current = {
          ...serverVersionsRef.current,
          [exerciseId]: updatedAt,
        };

        if (hasNewerChanges) {
          writeExerciseDraft(exerciseId, latestPayload, updatedAt);
        } else {
          latestPayloadsRef.current = {
            ...latestPayloadsRef.current,
            [exerciseId]: savedPayload,
          };
          removeDraft(workoutDraftKey(detail.session.id, exerciseId));
        }

        if (!mountedRef.current) return;
        setServerPayloads((current) => ({ ...current, [exerciseId]: savedPayload }));
        setServerVersions((current) => ({ ...current, [exerciseId]: updatedAt }));
        if (!hasNewerChanges) {
          setOverrides((current) => {
            const next = { ...current };
            delete next[exerciseId];
            return next;
          });
        }
      },
    });
  }
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
  const selectedLibraryExercise = libraryExercises.find(
    (exercise) =>
      exercise.id === selectedExerciseId &&
      !sessionExerciseLibraryIds.has(exercise.id),
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
  const hasCardioExercise = useMemo(
    () => sessionHasCardioExercise(detail.exercises),
    [detail.exercises],
  );

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

  useLayoutEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;
    const card = exerciseCardRefs.current.get(anchor.exerciseId);
    pendingScrollAnchorRef.current = null;
    if (!card) return;

    const delta = calculateScrollCompensation(anchor.beforeTop, card.getBoundingClientRect().top);
    if (delta !== 0) window.scrollBy(0, delta);
  }, [expandedExerciseId]);

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
  const interactionLocked = readOnly || finishStage !== null;
  const syncingCount = Object.values(statuses).filter((status) => status.pending).length;
  const syncErrorCount = Object.values(statuses).filter((status) => status.error).length;
  const stats = completionStats(Object.values(currentPayloads));
  const progressPercent =
    stats.totalSets === 0 ? 0 : Math.round((stats.completedSets / stats.totalSets) * 100);
  const hasUnsavedWork = dirtyIds.size > 0 || metadataDirty;
  const hasRoutineAccent = !readOnly && detail.session.routine_id !== null;
  const routineAccent = hasRoutineAccent
    ? routineColorCssVariable(detail.routineColor)
    : "var(--primary)";
  const restRemaining = restTimer
    ? Math.max(0, Math.ceil((restTimer.endAt - timerNow) / 1000))
    : 0;

  useEffect(() => {
    latestPayloadsRef.current = currentPayloads;
  }, [currentPayloads]);

  useEffect(() => {
    mountedRef.current = true;
    const autosave = autosaveRef.current;
    autosave?.activate();
    return () => {
      mountedRef.current = false;
      autosave?.dispose();
    };
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const autosave = autosaveRef.current;
    for (const exercise of detail.exercises) {
      autosave?.register({
        exerciseId: exercise.id,
        serverVersion: serverVersionsRef.current[exercise.id] ?? exercise.updated_at,
        serverPayload: serverPayloadsRef.current[exercise.id] ?? initialPayloads[exercise.id],
        localPayload: currentPayloads[exercise.id],
      });
    }
  }, [currentPayloads, detail.exercises, initialPayloads, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const retryWhenOnline = () => {
      void autosaveRef.current?.flushAll(exerciseIds);
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [exerciseIds, readOnly]);

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

  useEffect(() => {
    if (detail.session.status !== "completed") return;

    const key = finishConfirmationKey(detail.session.id);
    try {
      if (window.sessionStorage.getItem(key) !== "1") return;
      window.sessionStorage.removeItem(key);
      setFinishConfirmationOpen(true);
    } catch {
      // The confirmation is optional browser UI; the saved session remains correct if storage is unavailable.
    }
  }, [detail.session.id, detail.session.status]);

  function writeExerciseDraft(
    exerciseId: string,
    payload: WorkoutExercisePayload,
    serverUpdatedAt = serverVersionsRef.current[exerciseId],
  ) {
    const saved = writeDraft(workoutDraftKey(detail.session.id, exerciseId), {
      version: TRAINING_DRAFT_VERSION,
      sessionExerciseId: exerciseId,
      serverUpdatedAt,
      savedAt: new Date().toISOString(),
      payload,
    });
    if (!saved && mountedRef.current) setStorageError(true);
  }

  function updateExercise(
    exerciseId: string,
    updater: (current: WorkoutExercisePayload) => WorkoutExercisePayload,
    options?: { immediate?: boolean },
  ) {
    if (
      editingFencedRef.current ||
      removingExerciseIdsRef.current.has(exerciseId) ||
      readOnly
    ) return;
    const next = updater(latestPayloadsRef.current[exerciseId]);
    latestPayloadsRef.current = { ...latestPayloadsRef.current, [exerciseId]: next };
    setOverrides((current) => ({ ...current, [exerciseId]: next }));
    writeExerciseDraft(exerciseId, next);
    autosaveRef.current?.change(exerciseId, next, options);
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
    if (editingFencedRef.current || readOnly) return;
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

  async function discardExerciseDraft(exerciseId: string) {
    const autosave = autosaveRef.current;
    if (!autosave) return;
    let state: Awaited<ReturnType<typeof autosave.discardLocal>>;
    try {
      state = await autosave.discardLocal(exerciseId);
    } catch {
      return;
    }
    if (state.status !== "active") {
      router.refresh();
      return;
    }
    latestPayloadsRef.current = {
      ...latestPayloadsRef.current,
      [exerciseId]: state.payload,
    };
    setOverrides((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
    setStatuses((current) => ({
      ...current,
      [exerciseId]: {
        pending: false,
        saved: false,
        error: null,
        errorCategory: null,
      },
    }));
    removeDraft(workoutDraftKey(detail.session.id, exerciseId));
  }

  async function retryExercise(exerciseId: string) {
    await autosaveRef.current?.retry(exerciseId);
    const category = autosaveRef.current?.getErrorCategory(exerciseId);
    if (category === "session_closed" || category === "removed") router.refresh();
  }

  function toggleExercise(exerciseId: string) {
    const previouslyExpanded = expandedExerciseId;
    if (previouslyExpanded && previouslyExpanded !== exerciseId) {
      const card = exerciseCardRefs.current.get(exerciseId);
      if (card) {
        pendingScrollAnchorRef.current = {
          exerciseId,
          beforeTop: card.getBoundingClientRect().top,
        };
      }
    } else {
      pendingScrollAnchorRef.current = null;
    }
    if (previouslyExpanded) void autosaveRef.current?.flush(previouslyExpanded);
    setEditingNoteExerciseId(null);
    setExpandedExerciseId((current) => (current === exerciseId ? null : exerciseId));
  }

  async function addExistingExercise() {
    if (!selectedLibraryExercise) return;
    setGlobalPending(true);
    setGlobalError(null);
    const result = await appendWorkoutExerciseAction({
      sessionId: detail.session.id,
      exerciseId: selectedLibraryExercise.id,
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
    if (!window.confirm(`¿Quitar ${name} de esta sesión?`)) return;
    removingExerciseIdsRef.current.add(exerciseId);
    await autosaveRef.current?.pauseAndWait(exerciseId);
    setStatuses((current) => ({
      ...current,
      [exerciseId]: { pending: true, saved: false, error: null },
    }));
    const formData = new FormData();
    formData.set("session_id", detail.session.id);
    formData.set("id", exerciseId);
    try {
      await removeSessionExerciseAction(formData);
      await autosaveRef.current?.remove(exerciseId);
      removeDraft(workoutDraftKey(detail.session.id, exerciseId));
      router.refresh();
    } catch (error) {
      removingExerciseIdsRef.current.delete(exerciseId);
      autosaveRef.current?.resume(exerciseId);
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
    if (stats.completedSets === 0) {
      setGlobalError("Marcá al menos una serie antes de finalizar.");
      return;
    }
    editingFencedRef.current = true;
    setGlobalPending(true);
    setFinishStage("saving");
    setGlobalError(null);
    const failedExerciseIds =
      (await autosaveRef.current?.fenceAndFlushAll(exerciseIds)) ?? [];
    if (failedExerciseIds.length > 0) {
      const names = failedExerciseIds.map(
        (exerciseId) =>
          detail.exercises.find((exercise) => exercise.id === exerciseId)?.nombre_snapshot ??
          "Ejercicio",
      );
      setGlobalPending(false);
      setFinishStage(null);
      editingFencedRef.current = false;
      autosaveRef.current?.releaseFence();
      const sessionUnavailable = failedExerciseIds.some((exerciseId) => {
        const category = autosaveRef.current?.getErrorCategory(exerciseId);
        return category === "session_closed" || category === "removed";
      });
      setGlobalError(
        sessionUnavailable
          ? "La sesión ya fue finalizada o modificada en otra pestaña. Actualizando…"
          : `No pudimos finalizar todavía. No se pudo guardar: ${names.join(", ")}. Reintentá cuando tengas conexión.`,
      );
      if (sessionUnavailable) router.refresh();
      return;
    }

    setFinishStage("finishing");
    const result = await finishWorkoutSessionAction({
      sessionId: detail.session.id,
      metadata,
    });
    setGlobalPending(false);
    if (!result.ok) {
      setFinishStage(null);
      editingFencedRef.current = false;
      autosaveRef.current?.releaseFence();
      if (result.error.toLocaleLowerCase("es").includes("ya finaliz")) {
        setGlobalError("La sesión ya fue finalizada en otra pestaña. Actualizando…");
        router.refresh();
      } else {
        setGlobalError(result.error);
      }
      return;
    }
    try {
      // This transient marker is consumed after the refreshed completed detail mounts.
      // Clearing it on page hide also prevents it from surviving a browser reload.
      const key = finishConfirmationKey(detail.session.id);
      const clearConfirmation = () => window.sessionStorage.removeItem(key);
      window.sessionStorage.setItem(key, "1");
      window.addEventListener("pagehide", clearConfirmation, { once: true });
    } catch {
      // Saving succeeded. Keep the existing flow functional if browser storage is unavailable.
    }
    autosaveRef.current?.dispose();
    for (const key of draftKeys) removeDraft(key);
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
    await Promise.all(
      exerciseIds.map((exerciseId) => autosaveRef.current?.pauseAndWait(exerciseId)),
    );
    const result = await cancelWorkoutSessionAction({ sessionId: detail.session.id });
    setGlobalPending(false);
    if (!result.ok) {
      for (const exerciseId of exerciseIds) autosaveRef.current?.resume(exerciseId);
      setGlobalError(result.error);
      return;
    }
    autosaveRef.current?.dispose();
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
      <header
        className={cn(
          "relative space-y-3 border-b border-border/70 pb-4",
          hasRoutineAccent && "pl-3",
        )}
      >
        {hasRoutineAccent ? (
          <span
            className="absolute bottom-4 left-0 top-0 w-[3px] rounded-full"
            style={{ backgroundColor: routineAccent }}
            aria-hidden
          />
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {detail.session.session_name ??
                detail.session.routine_name_snapshot ??
                "Sesión libre"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatSessionDate(detail.logDate)}</p>
          </div>
          {!readOnly && (syncErrorCount > 0 || syncingCount > 0 || metadataDirty) ? (
            <span
              className={cn(
                "mt-1 shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                syncErrorCount > 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              {syncErrorCount > 0
                ? `${syncErrorCount} sin sincronizar`
                : syncingCount > 0
                  ? "Sincronizando"
                  : "Resumen en borrador"}
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
              className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progressPercent}%`, backgroundColor: routineAccent }}
            />
          </div>
        </div>
        <SessionTiming
          startedAt={detail.session.started_at}
          endedAt={detail.session.ended_at}
          isActive={!readOnly}
        />
        {detail.session.status === "completed" ? (
          <CompletedSessionActions
            sessionId={detail.session.id}
            sessionName={detail.session.routine_name_snapshot ?? detail.session.session_name ?? "Sesión libre"}
            dateLabel={formatSessionDate(detail.logDate)}
            timingLabel={formatWorkoutTimeRange(detail.session.started_at, detail.session.ended_at)}
            completedSets={stats.completedSets}
          />
        ) : null}
      </header>

      {storageError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          El navegador no permitió guardar el borrador local. No cierres esta pestaña hasta
          guardar los ejercicios.
        </div>
      ) : null}

      {!readOnly ? (
        <AddExerciseSheet
          open={exercisePickerOpen}
          onOpenChange={setExercisePickerOpen}
          sessionId={detail.session.id}
          exercises={libraryExercises}
          filteredExercises={filteredLibraryExercises}
          muscleGroups={[...MUSCLE_GROUP_OPTIONS]}
          selectedMuscleGroup={selectedMuscleGroup}
          onMuscleGroupChange={setSelectedMuscleGroup}
          search={exerciseSearch}
          onSearchChange={setExerciseSearch}
          selectedExerciseId={selectedExerciseId}
          onSelectExercise={setSelectedExerciseId}
          onAddExercise={() => void addExistingExercise()}
          pending={globalPending}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Ejercicios</h2>
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={globalPending}
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
            const restLabel = configuredRestLabel(
              exercise.rest_min_seconds_snapshot,
              exercise.rest_max_seconds_snapshot,
            );
            const receivedReminder = !readOnly
              ? nextSessionReminder(
                  exercise.next_adjustment_snapshot,
                  exercise.next_adjustment_note_snapshot,
                )
              : null;
            const exerciseContentId = `session-exercise-${exercise.id}`;
            const exerciseMeta = exerciseIdentityLabel({
              grupo_muscular: exercise.grupo_muscular_snapshot,
              muscle_group_label: exercise.muscle_group_label_snapshot,
              implement: exercise.implement_snapshot,
              weight_mode: exercise.weight_mode_snapshot,
            });
            const collapsedSubtitle = exerciseMeta;
            const progressLabel = exerciseProgressLabel(payload);
            const quickNote = payload.notes.trim();
            const autosaveVisualStatus = compactAutosaveStatus({
              saved: Boolean(status?.saved),
              saving: Boolean(status?.pending),
              dirty,
              error: status?.error ?? null,
            });
            const autosaveStatusLabel = {
              idle: "Sin cambios pendientes",
              saved: "Guardado",
              saving: "Guardando cambios",
              dirty: "Cambios pendientes",
              error: "Error al guardar",
            }[autosaveVisualStatus];
            const noteLabel = exercise.routine_exercise_id
              ? "Nota para próximas sesiones"
              : "Nota del ejercicio en esta sesión";
            const noteEditorOpen = editingNoteExerciseId === exercise.id;
            return (
              <div
                key={exercise.id}
                ref={(node) => {
                  if (node) exerciseCardRefs.current.set(exercise.id, node);
                  else exerciseCardRefs.current.delete(exercise.id);
                }}
              >
                <Card
                  size="sm"
                  className={cn(
                    "relative gap-0 overflow-hidden py-0 transition-[box-shadow,transform] duration-200 motion-reduce:transition-none",
                    expanded && "shadow-md ring-1 ring-primary/30",
                    completion.isComplete && !expanded && "ring-emerald-500/20",
                  )}
                >
                <span
                  className={cn(
                    "absolute inset-y-3 left-0 w-0.5 rounded-r-full transition-opacity duration-200",
                    expanded ? "opacity-100" : "opacity-35",
                  )}
                  style={{ backgroundColor: routineAccent }}
                  aria-hidden
                />
                <CardHeader className="p-0">
                  <button
                    type="button"
                    className="grid min-h-[4.25rem] w-full touch-manipulation grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-muted/40 active:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                    aria-expanded={expanded}
                    aria-controls={exerciseContentId}
                    onClick={() => toggleExercise(exercise.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
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
                        {!expanded ? collapsedSubtitle : exerciseMeta}
                      </p>
                      {receivedReminder ? (
                        <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] font-medium text-primary">
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">Revisar hoy · {receivedReminder}</span>
                        </p>
                      ) : null}
                      {staleDraftIds.has(exercise.id) ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          Borrador anterior sin aplicar
                        </p>
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-2" aria-label={`${progressLabel} series completadas`}>
                      <span
                        className={cn(
                          "metric-number min-w-[4.25rem] rounded-full border px-2 py-1 text-center text-xs font-medium tabular-nums",
                          completion.isComplete &&
                            "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {progressLabel}
                      </span>
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center",
                          autosaveVisualStatus === "saved" &&
                            "text-emerald-700 dark:text-emerald-300",
                          autosaveVisualStatus === "saving" && "text-primary",
                          autosaveVisualStatus === "dirty" &&
                            "text-amber-700 dark:text-amber-300",
                          autosaveVisualStatus === "error" && "text-destructive",
                        )}
                        role="status"
                        aria-live="polite"
                        aria-label={autosaveStatusLabel}
                      >
                        {autosaveVisualStatus === "saved" ? (
                          <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
                        ) : autosaveVisualStatus === "saving" ? (
                          <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                        ) : autosaveVisualStatus === "dirty" ? (
                          <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        ) : autosaveVisualStatus === "error" ? (
                          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                        ) : null}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                          expanded && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>
                </CardHeader>
                {expanded ? (
                  <CardContent
                    id={exerciseContentId}
                    className="space-y-3 border-t border-border/70 px-3 pb-3 pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200"
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

                  {receivedReminder ? (
                    <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-primary">
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Revisar hoy</p>
                        <p className="mt-0.5 break-words font-medium text-foreground">
                          {receivedReminder}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {quickNote ? (
                    <div className="flex gap-2 border-b border-border/60 px-1 pb-2 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {exercise.routine_exercise_id
                            ? "Nota para próximas sesiones"
                            : "Nota del ejercicio en esta sesión"}
                        </p>
                        <p className="line-clamp-2">{quickNote}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border border-border/75 bg-background/35">
                    <div
                      className={cn(
                        "border-b border-border/60 bg-muted/35 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                        SET_GRID_SHARED,
                      )}
                    >
                      <div className="flex min-w-0 items-center justify-center">Serie</div>
                      <div className="flex min-w-0 items-center justify-center">kg</div>
                      <div className="flex min-w-0 items-center justify-center">reps</div>
                      <div className="flex min-w-0 items-center justify-center">RIR</div>
                      <div className="flex min-w-0 items-center justify-center" aria-label="Completada">✓</div>
                    </div>
                    {payload.sets.map((set, setIndex) => (
                      <SetRow
                        key={set.set_number}
                        exerciseId={exercise.id}
                        set={set}
                        setIndex={setIndex}
                        readOnly={interactionLocked}
                        onChange={(updater, options) =>
                          updateExercise(
                            exercise.id,
                            (current) =>
                              renumberWorkoutPayload({
                                ...current,
                                sets: current.sets.map((currentSet, currentIndex) =>
                                  currentIndex === setIndex ? updater(currentSet) : currentSet,
                                ),
                              }),
                            options,
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
                      {!interactionLocked ? (
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
                      disabled={interactionLocked || payload.sets.length >= 50}
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

                  {!readOnly && status?.error ? (
                    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <div className="min-w-0" aria-live="polite">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
                          No se pudo guardar
                        </p>
                        <p className="mt-1 text-xs leading-snug text-destructive">
                          {status.error}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {status.errorCategory === "conflict" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void discardExerciseDraft(exercise.id)}
                          >
                            Usar versión guardada
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void retryExercise(exercise.id)}
                        >
                          {status.errorCategory === "conflict"
                            ? "Comprobar cambios"
                            : status.errorCategory === "session_closed" ||
                                status.errorCategory === "removed"
                              ? "Actualizar"
                              : "Reintentar"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <section className="space-y-3 border-t border-border/60 pt-3">
                    <div className="flex min-h-8 items-center justify-between gap-3 px-1">
                      <Label>Próxima vez</Label>
                      {hasFutureExerciseAction(payload.decision, payload.apply_to_routine) ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Check className="size-3.5" strokeWidth={2.75} aria-hidden />
                          Configurada
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin cambios</span>
                      )}
                    </div>
                    <div className="space-y-3 pb-1">
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Decisión para la próxima vez">
                          {NEXT_SESSION_DECISIONS.map((adjustment) => (
                            <Button
                              key={adjustment.value}
                              type="button"
                              size="sm"
                              variant={payload.decision === adjustment.value ? "secondary" : "outline"}
                              disabled={interactionLocked}
                              aria-pressed={payload.decision === adjustment.value}
                              onClick={() =>
                                updateExercise(
                                  exercise.id,
                                  (current) => ({
                                    ...current,
                                    decision: toggleTrainingDecision(
                                      current.decision,
                                      adjustment.value,
                                    ),
                                    decision_note: "",
                                  }),
                                  { immediate: true },
                                )
                              }
                            >
                              {adjustment.label}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Recordatorio para tu próxima sesión.
                        </p>
                      </div>

                      {payload.decision === "custom" ? (
                        <div className="space-y-2 border-l-2 border-primary/35 pl-3">
                          <div>
                            <p className="text-xs font-medium text-primary">
                              Recordatorio anterior
                            </p>
                            <p className="mt-1 break-words text-sm">
                              {payload.decision_note}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={interactionLocked}
                            onClick={() =>
                              updateExercise(
                                exercise.id,
                                (current) => ({
                                  ...current,
                                  decision: toggleTrainingDecision(
                                    current.decision,
                                    "maintain",
                                  ),
                                  decision_note: "",
                                }),
                                { immediate: true },
                              )
                            }
                          >
                            Quitar
                          </Button>
                        </div>
                      ) : null}

                      {exercise.routine_exercise_id ? (
                        <label
                          className={cn(
                            "flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors focus-within:ring-3 focus-within:ring-ring/50",
                            payload.apply_to_routine
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/75 bg-background/35 hover:bg-muted/35",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={payload.apply_to_routine}
                            disabled={interactionLocked}
                            onChange={(event) =>
                              updateExercise(
                                exercise.id,
                                (current) => ({
                                  ...current,
                                  apply_to_routine: event.target.checked,
                                }),
                                { immediate: true },
                              )
                            }
                          />
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                              payload.apply_to_routine
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background",
                            )}
                            aria-hidden
                          >
                            {payload.apply_to_routine ? (
                              <Check className="size-3.5" strokeWidth={3} />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">
                              Usar lo realizado hoy como nuevo objetivo
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              Al finalizar, sólo toma las series completadas.
                            </span>
                          </span>
                        </label>
                      ) : null}

                      <div className="space-y-2 pt-0.5">
                        <div className="flex min-h-8 items-center justify-between gap-3">
                          {noteEditorOpen ? (
                            <Label htmlFor={`exercise-notes-${exercise.id}`}>{noteLabel}</Label>
                          ) : (
                            <p className="text-sm font-medium">{noteLabel}</p>
                          )}
                          {!readOnly ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={interactionLocked}
                              aria-expanded={noteEditorOpen}
                              aria-controls={`exercise-notes-${exercise.id}`}
                              onClick={() =>
                                setEditingNoteExerciseId(noteEditorOpen ? null : exercise.id)
                              }
                            >
                              {noteEditorOpen ? "Listo" : quickNote ? "Editar" : "Agregar"}
                            </Button>
                          ) : null}
                        </div>
                        {noteEditorOpen ? (
                          <textarea
                            id={`exercise-notes-${exercise.id}`}
                            aria-label={`Nota para ${exercise.nombre_snapshot}`}
                            className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60"
                            value={payload.notes}
                            disabled={interactionLocked}
                            placeholder="Opcional"
                            onChange={(event) =>
                              updateExercise(exercise.id, (current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          <p
                            className={cn(
                              "line-clamp-1 text-sm",
                              quickNote ? "text-muted-foreground" : "text-muted-foreground/80",
                            )}
                          >
                            {quickNote || "Sin nota"}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

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
                            disabled={globalPending}
                            onClick={() => void discardExerciseDraft(exercise.id)}
                          >
                            Descartar cambios
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={globalPending}
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
              </div>
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
          <fieldset className="space-y-4 disabled:opacity-80" disabled={interactionLocked}>
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
          {hasCardioExercise ? (
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-sm font-medium">Cardio</p>
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
            </div>
          ) : null}
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
            disabled={globalPending || stats.completedSets === 0}
            onClick={() => void finishSession()}
          >
            {finishStage ? "Finalizando…" : "Finalizar entrenamiento"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {finishStage === "saving"
              ? "Guardando los últimos cambios antes de cerrar la sesión…"
              : finishStage === "finishing"
                ? "Todos los ejercicios están sincronizados. Cerrando la sesión…"
              : "Solo se actualiza la rutina donde activaste “Guardar lo realizado como nuevo objetivo”."}
          </p>
          <div aria-live="polite">
            {globalError ? <p className="text-sm text-destructive">{globalError}</p> : null}
          </div>
          <details className="group relative rounded-xl border border-border/80 px-3 py-2">
            <span
              className="pointer-events-none absolute bottom-2.5 left-3 top-2.5 w-[3px] rounded-full bg-destructive/80"
              aria-hidden
            />
            <summary className="-mx-1 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 pl-4 pr-2 text-sm font-medium outline-none transition-[background-color,color] duration-150 hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              Más opciones
              <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="space-y-2 pb-1 pl-4 pt-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
              <Button
                className="h-11 w-full"
                type="button"
                variant="destructive"
                disabled={globalPending}
                onClick={() => void cancelSession()}
              >
                Cancelar entrenamiento
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
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

      <WorkoutFinishedDialog
        open={finishConfirmationOpen}
        onOpenChange={setFinishConfirmationOpen}
        sessionName={
          detail.session.routine_name_snapshot ?? detail.session.session_name ?? "Sesión libre"
        }
        duration={formatWorkoutDuration(
          getWorkoutElapsedMilliseconds(detail.session.started_at, detail.session.ended_at),
        )}
        completedSets={stats.completedSets}
        completedExercises={Object.values(currentPayloads).filter((payload) =>
          payload.sets.some((set) => set.is_completed),
        ).length}
      />

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
