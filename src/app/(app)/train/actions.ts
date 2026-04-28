"use server";

import { revalidatePath } from "next/cache";
import type { MuscleGroup } from "@/lib/phase2/types";
import {
  addExistingExerciseToSession,
  addExerciseToRoutine,
  archiveExercise,
  createExercise,
  createExerciseFromSession,
  createRoutine,
  finishSession,
  removeSessionExercise,
  removeRoutineExercise,
  replaceRoutineExercises,
  startFreeSession,
  startSessionFromRoutine,
  updateExercise,
  updateRoutine,
  updateSessionExercise,
} from "@/lib/phase2/training";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function numOptional(formData: FormData, key: string): number | null | undefined {
  const v = formData.get(key);
  if (v === null) return undefined; // key ausente: no tocar en DB
  const raw = String(v).trim();
  if (!raw) return null; // key presente pero vacío: borrar valor
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createExerciseAction(formData: FormData) {
  const nombre = str(formData, "nombre");
  const grupo_muscular = (str(formData, "grupo_muscular") ||
    null) as MuscleGroup | null;
  const series_sugeridas = num(formData, "series_sugeridas");
  const reps_sugeridas = num(formData, "reps_sugeridas");
  const peso_sugerido = num(formData, "peso_sugerido");

  await createExercise({
    nombre,
    grupo_muscular,
    series_sugeridas,
    reps_sugeridas,
    peso_sugerido,
  });
  revalidatePath("/train/exercises");
}

export async function updateExerciseAction(formData: FormData) {
  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const grupo_muscular = (str(formData, "grupo_muscular") ||
    null) as MuscleGroup | null;
  const series_sugeridas = num(formData, "series_sugeridas");
  const reps_sugeridas = num(formData, "reps_sugeridas");
  const peso_sugerido = num(formData, "peso_sugerido");

  await updateExercise({
    id,
    nombre,
    grupo_muscular,
    series_sugeridas,
    reps_sugeridas,
    peso_sugerido,
  });
  revalidatePath("/train/exercises");
}

export async function archiveExerciseAction(formData: FormData) {
  const id = str(formData, "id");
  await archiveExercise(id);
  revalidatePath("/train/exercises");
}

export async function createRoutineAction(formData: FormData) {
  const nombre = str(formData, "nombre");
  const color = str(formData, "color") || null;
  await createRoutine({ nombre, color });
  revalidatePath("/train/routines");
}

export async function updateRoutineAction(formData: FormData) {
  const id = str(formData, "id");
  const nombre = str(formData, "nombre");
  const color = str(formData, "color") || null;
  await updateRoutine({ id, nombre, color });
  revalidatePath("/train/routines");
  revalidatePath(`/train/routines/${id}`);
}

export async function replaceRoutineExercisesAction(formData: FormData) {
  const routineId = str(formData, "routine_id");

  // items_json: [{exercise_id}]
  const itemsJson = str(formData, "items_json");
  const items = itemsJson ? (JSON.parse(itemsJson) as any[]) : [];

  await replaceRoutineExercises({
    routineId,
    items: items.map((it) => ({
      exercise_id: String(it.exercise_id),
    })),
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
  const date = str(formData, "date");
  const session = await startFreeSession({ date });
  revalidatePath("/train");
  revalidatePath("/train/session/new");
  revalidatePath(`/train/session/${session.id}`);
  return session.id;
}

export async function startSessionFromRoutineAction(formData: FormData) {
  const date = str(formData, "date");
  const routineId = str(formData, "routine_id");
  const { session } = await startSessionFromRoutine({ date, routineId });
  revalidatePath("/train");
  revalidatePath("/train/session/new");
  revalidatePath(`/train/session/${session.id}`);
  return session.id;
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
  const series_sugeridas = num(formData, "series_sugeridas");
  const reps_sugeridas = num(formData, "reps_sugeridas");
  const peso_sugerido = num(formData, "peso_sugerido");

  await createExerciseFromSession({
    sessionId,
    nombre,
    grupo_muscular,
    series_sugeridas,
    reps_sugeridas,
    peso_sugerido,
  });
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

