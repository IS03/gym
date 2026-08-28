"use server";

import { revalidatePath } from "next/cache";
import type { MuscleGroup } from "@/lib/phase2/types";
import { parseLocalizedDecimal } from "@/lib/localized-decimal";
import { assertRoutineColor } from "@/lib/phase2/routine-colors";
import type {
  ExerciseActionExercise,
  ExerciseActionResult,
  ExerciseMutationInput,
} from "@/lib/phase2/exercise-mutation";
import { normalizeExerciseMutation } from "@/lib/phase2/exercise-mutation";
import {
  addExistingExerciseToSession,
  addExerciseToRoutine,
  archiveExercise,
  createExercise,
  createExerciseFromSession,
  archiveRoutine,
  createRoutine,
  finishSession,
  getInProgressSessionForUser,
  removeSessionExercise,
  removeRoutineExercise,
  replaceRoutineExercises,
  updateExercise,
  updateRoutine,
  updateSessionExercise,
} from "@/lib/phase2/training";
import {
  appendWorkoutExercise,
  cancelWorkoutSession,
  correctCompletedWorkoutSession,
  discardCompletedWorkoutSession,
  finishWorkoutSession,
  getWorkoutExerciseSyncState,
  importInitialTrainingPlan,
  moveRoutineExerciseTarget,
  saveRoutineExerciseTarget,
  saveWorkoutExercise,
  startWorkoutSession,
  todayInCordoba,
  workoutSaveErrorCategory,
} from "@/lib/phase2/training-robust";
import type {
  WorkoutExerciseSyncState,
  WorkoutSaveErrorCategory,
} from "@/lib/phase2/training-robust";
import {
  toWorkoutStartActiveSession,
  type StartWorkoutActionResult,
} from "@/lib/phase2/workout-start";
import type {
  RoutineExercisePayload,
  CompletedSessionCorrectionInput,
  SessionMetadataInput,
  WorkoutExercisePayload,
} from "@/lib/phase2/types";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const parsed = parseLocalizedDecimal(raw);
  if (parsed === null) throw new Error(`${key} debe ser un número decimal válido.`);
  return parsed;
}

function numOptional(formData: FormData, key: string): number | null | undefined {
  const v = formData.get(key);
  if (v === null) return undefined; // key ausente: no tocar en DB
  const raw = String(v).trim();
  if (!raw) return null; // key presente pero vacío: borrar valor
  const parsed = parseLocalizedDecimal(raw);
  if (parsed === null) throw new Error(`${key} debe ser un número decimal válido.`);
  return parsed;
}

function toExerciseActionExercise(exercise: Awaited<ReturnType<typeof createExercise>>): ExerciseActionExercise {
  return {
    id: exercise.id,
    nombre: exercise.nombre,
    grupo_muscular: exercise.grupo_muscular,
    muscle_group_label: exercise.muscle_group_label,
    implement: exercise.implement,
    weight_mode: exercise.weight_mode,
    series_sugeridas: exercise.series_sugeridas,
    reps_sugeridas: exercise.reps_sugeridas,
    peso_sugerido: exercise.peso_sugerido,
    rir_sugerido: exercise.rir_sugerido,
    descanso_min_sugerido_segundos: exercise.descanso_min_sugerido_segundos,
    descanso_max_sugerido_segundos: exercise.descanso_max_sugerido_segundos,
    updated_at: exercise.updated_at,
  };
}

export async function createExerciseAction(
  input: ExerciseMutationInput,
): Promise<ExerciseActionResult<ExerciseActionExercise>> {
  try {
    const exercise = await createExercise(normalizeExerciseMutation(input));
    revalidatePath("/train/exercises");
    return { ok: true, data: toExerciseActionExercise(exercise) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el ejercicio.",
    };
  }
}

export async function updateExerciseAction(
  id: string,
  input: ExerciseMutationInput,
): Promise<ExerciseActionResult<ExerciseActionExercise>> {
  try {
    if (!id.trim()) throw new Error("Falta el ejercicio a editar.");
    const exercise = await updateExercise({
      id,
      ...normalizeExerciseMutation(input),
    });
    revalidatePath("/train/exercises");
    return { ok: true, data: toExerciseActionExercise(exercise) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudieron guardar los cambios.",
    };
  }
}

export async function archiveExerciseAction(
  id: string,
): Promise<ExerciseActionResult> {
  try {
    if (!id.trim()) throw new Error("Falta el ejercicio a archivar.");
    await archiveExercise(id);
    revalidatePath("/train/exercises");
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo archivar el ejercicio.",
    };
  }
}

export type CreateRoutineState = { error: string | null; id?: string };

export async function createRoutineAction(
  _prev: CreateRoutineState,
  formData: FormData,
): Promise<CreateRoutineState> {
  try {
    const nombre = str(formData, "nombre");
    const color = assertRoutineColor(str(formData, "color") || null);
    const routine = await createRoutine({ nombre, color });
    revalidatePath("/train/routines");
    revalidatePath(`/train/routines/${routine.id}`);
    return { error: null, id: routine.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function archiveRoutineAction(id: string) {
  if (!id.trim()) throw new Error("Falta id de rutina.");
  await archiveRoutine(id);
  revalidatePath("/train/routines");
  revalidatePath(`/train/routines/${id}`);
  revalidatePath("/train");
  revalidatePath("/train/session/new");
}

export async function restoreRoutineAction(id: string) {
  if (!id.trim()) throw new Error("Falta id de rutina.");
  await updateRoutine({ id, is_active: true });
  revalidatePath("/train/routines");
  revalidatePath(`/train/routines/${id}`);
  revalidatePath("/train");
  revalidatePath("/train/session/new");
}

export async function updateRoutineAction(formData: FormData) {
  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const color = assertRoutineColor(str(formData, "color") || null);
  await updateRoutine({ id, nombre, color });
  revalidatePath("/train/routines");
  revalidatePath(`/train/routines/${id}`);
}

export async function replaceRoutineExercisesAction(formData: FormData) {
  const routineId = str(formData, "routine_id");

  // items_json: [{exercise_id}]
  const itemsJson = str(formData, "items_json");
  const parsed: unknown = itemsJson ? JSON.parse(itemsJson) : [];
  const items = Array.isArray(parsed) ? parsed : [];

  await replaceRoutineExercises({
    routineId,
    items: items.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const exerciseId = (item as Record<string, unknown>).exercise_id;
      return typeof exerciseId === "string" ? [{ exercise_id: exerciseId }] : [];
    }),
  });

  revalidatePath(`/train/routines/${routineId}`);
}

export async function addExerciseToRoutineAction(formData: FormData) {
  const routineId = str(formData, "routine_id");
  const exerciseId = str(formData, "exercise_id");
  await addExerciseToRoutine({ routineId, exerciseId });
  revalidatePath(`/train/routines/${routineId}`);
}

export async function removeRoutineExerciseAction(formData: FormData) {
  const routineId = str(formData, "routine_id");
  const routineExerciseId = str(formData, "routine_exercise_id");
  await removeRoutineExercise({ routineExerciseId });
  revalidatePath(`/train/routines/${routineId}`);
}

export async function startFreeSessionAction(formData: FormData) {
  const date = str(formData, "date") || todayInCordoba();
  const sessionId = await startWorkoutSession({ date, routineId: null });
  revalidatePath("/train");
  revalidatePath("/train/session/new");
  revalidatePath(`/train/session/${sessionId}`);
  return sessionId;
}

export async function startSessionFromRoutineAction(formData: FormData) {
  const date = str(formData, "date") || todayInCordoba();
  const routineId = str(formData, "routine_id");
  const sessionId = await startWorkoutSession({ date, routineId });
  revalidatePath("/train");
  revalidatePath("/train/session/new");
  revalidatePath(`/train/session/${sessionId}`);
  return sessionId;
}

export async function startWorkoutFromSheetAction(input: {
  routineId: string | null;
}): Promise<StartWorkoutActionResult> {
  if (input.routineId !== null && !input.routineId.trim()) {
    return { status: "error", message: "Elegí una rutina válida." };
  }

  const formData = new FormData();
  if (input.routineId !== null) {
    formData.set("routine_id", input.routineId);
  }

  try {
    const sessionId =
      input.routineId === null
        ? await startFreeSessionAction(formData)
        : await startSessionFromRoutineAction(formData);
    return { status: "started", sessionId };
  } catch (error) {
    try {
      const activeSession = await getInProgressSessionForUser();
      if (activeSession) {
        return {
          status: "active",
          session: toWorkoutStartActiveSession(activeSession),
        };
      }
    } catch {
      // El error original describe mejor el fallo de creación.
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "No pudimos iniciar el entrenamiento. Probá de nuevo.",
    };
  }
}

export async function addExistingExerciseToSessionAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const exerciseId = str(formData, "exercise_id");
  await addExistingExerciseToSession({ sessionId, exerciseId });
  revalidatePath(`/train/session/${sessionId}`);
}

export async function createExerciseFromSessionAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const nombre = str(formData, "nombre");
  const grupo_muscular = (str(formData, "grupo_muscular") ||
    null) as MuscleGroup | null;
  const muscle_group_label = str(formData, "muscle_group_label");
  const implement = str(formData, "implement");
  const weight_mode = str(formData, "weight_mode");
  const series_sugeridas = num(formData, "series_sugeridas");
  const reps_sugeridas = num(formData, "reps_sugeridas");
  const peso_sugerido = num(formData, "peso_sugerido");
  const rir_sugerido = num(formData, "rir_sugerido");
  const descanso_min_sugerido_segundos = num(
    formData,
    "descanso_min_sugerido_segundos",
  );
  const descanso_max_sugerido_segundos = num(
    formData,
    "descanso_max_sugerido_segundos",
  );

  const exercise = normalizeExerciseMutation({
    nombre,
    grupo_muscular,
    muscle_group_label,
    implement,
    weight_mode,
    series_sugeridas,
    reps_sugeridas,
    peso_sugerido,
    rir_sugerido,
    descanso_min_sugerido_segundos,
    descanso_max_sugerido_segundos,
  });
  await createExerciseFromSession({ sessionId, ...exercise });
  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath("/train/exercises");
}

export async function removeSessionExerciseAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const id = str(formData, "id");
  await removeSessionExercise(id);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function finishSessionAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  await finishSession(sessionId);
  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath("/train");
  revalidatePath("/train/session/new");
}

export async function updateSessionExerciseAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const id = str(formData, "id");

  // Solo tocar is_completed si el cliente envió la clave (marcar o desmarcar "Hecho").
  // "1" = hecho, "0" = no hecho (el checkbox nunca manda is_completed: false con FormData).
  let is_completed: boolean | undefined;
  if (formData.has("is_completed")) {
    is_completed = String(formData.get("is_completed")) === "1";
  } else {
    is_completed = undefined;
  }

  await updateSessionExercise({
    id,
    series_reales: numOptional(formData, "series_reales"),
    reps_reales: numOptional(formData, "reps_reales"),
    peso_real: numOptional(formData, "peso_real"),
    is_completed,
  });

  revalidatePath(`/train/session/${sessionId}`);
}

export type TrainingActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}

export async function importInitialTrainingPlanAction(): Promise<
  TrainingActionResult<{ routines: number; exercises: number }>
> {
  try {
    const result = await importInitialTrainingPlan();
    revalidatePath("/train");
    revalidatePath("/train/routines");
    revalidatePath("/train/exercises");
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function saveRoutineExerciseTargetAction(input: {
  routineId: string;
  routineExerciseId: string;
  payload: RoutineExercisePayload;
}): Promise<TrainingActionResult<{ updatedAt: string }>> {
  try {
    const updatedAt = await saveRoutineExerciseTarget(input);
    revalidatePath(`/train/routines/${input.routineId}`);
    return { ok: true, data: { updatedAt } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function moveRoutineExerciseTargetAction(input: {
  routineId: string;
  routineExerciseId: string;
  direction: -1 | 1;
}): Promise<TrainingActionResult> {
  try {
    await moveRoutineExerciseTarget(input);
    revalidatePath(`/train/routines/${input.routineId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function appendWorkoutExerciseAction(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<TrainingActionResult<{ sessionExerciseId: string }>> {
  try {
    const sessionExerciseId = await appendWorkoutExercise(input);
    revalidatePath(`/train/session/${input.sessionId}`);
    return { ok: true, data: { sessionExerciseId } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function saveWorkoutExerciseAction(input: {
  sessionId: string;
  sessionExerciseId: string;
  expectedUpdatedAt: string;
  payload: WorkoutExercisePayload;
}): Promise<
  | { ok: true; data: { updatedAt: string } }
  | { ok: false; error: string; errorCategory: WorkoutSaveErrorCategory }
> {
  const startedAt = Date.now();
  try {
    const updatedAt = await saveWorkoutExercise(input);
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 2_000) {
      console.warn("[workout-exercise-save] slow", {
        operation: "save_workout_exercise",
        durationMs,
        sessionExerciseId: input.sessionExerciseId,
      });
    }
    // Background autosave reconciles this exercise in the client. Structural
    // changes and finalization still revalidate the session explicitly.
    return { ok: true, data: { updatedAt } };
  } catch (error) {
    const errorCategory = workoutSaveErrorCategory(error);
    console.error("[workout-exercise-save] failed", {
      operation: "save_workout_exercise",
      durationMs: Date.now() - startedAt,
      errorCategory,
      sessionExerciseId: input.sessionExerciseId,
    });
    return { ok: false, error: actionError(error), errorCategory };
  }
}

export async function getWorkoutExerciseSyncStateAction(input: {
  sessionId: string;
  sessionExerciseId: string;
}): Promise<TrainingActionResult<WorkoutExerciseSyncState>> {
  try {
    return { ok: true, data: await getWorkoutExerciseSyncState(input) };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function finishWorkoutSessionAction(input: {
  sessionId: string;
  metadata: SessionMetadataInput;
}): Promise<TrainingActionResult<{ sessionId: string }>> {
  try {
    const sessionId = await finishWorkoutSession(input);
    revalidatePath("/train");
    revalidatePath("/train/calendar");
    revalidatePath("/train/history");
    revalidatePath("/train/progress");
    revalidatePath(`/train/session/${input.sessionId}`);
    return { ok: true, data: { sessionId } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function cancelWorkoutSessionAction(input: {
  sessionId: string;
}): Promise<TrainingActionResult> {
  try {
    await cancelWorkoutSession(input.sessionId);
    revalidatePath("/train");
    revalidatePath("/train/session/new");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

function revalidateCompletedSessionViews(sessionId: string) {
  revalidatePath("/home");
  revalidatePath("/train/history");
  revalidatePath("/train/progress");
  revalidatePath("/train/calendar");
  revalidatePath(`/train/session/${sessionId}`);
}

export async function correctCompletedWorkoutSessionAction(
  input: CompletedSessionCorrectionInput,
): Promise<TrainingActionResult<{ sessionId: string }>> {
  try {
    const sessionId = await correctCompletedWorkoutSession(input);
    revalidateCompletedSessionViews(sessionId);
    return { ok: true, data: { sessionId } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}

export async function discardCompletedWorkoutSessionAction(input: {
  sessionId: string;
}): Promise<TrainingActionResult<{ sessionId: string }>> {
  try {
    const sessionId = await discardCompletedWorkoutSession(input.sessionId);
    revalidateCompletedSessionViews(sessionId);
    return { ok: true, data: { sessionId } };
  } catch (error) {
    return { ok: false, error: actionError(error) };
  }
}
