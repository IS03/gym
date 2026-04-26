"use server";

import { revalidatePath } from "next/cache";
import type { ExerciseType, RoutineType } from "@/lib/phase2/types";
import {
  addExistingExerciseToSession,
  archiveExercise,
  createExercise,
  createExerciseFromSession,
  createRoutine,
  removeSessionExercise,
  replaceRoutineExercises,
  startFreeSession,
  startSessionFromRoutine,
  upsertWorkoutSet,
  updateExercise,
  updateRoutine,
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

export async function createExerciseAction(formData: FormData) {
  const name = str(formData, "name");
  const category = str(formData, "category") || null;
  const exercise_type = str(formData, "exercise_type") as ExerciseType;

  await createExercise({ name, category, exercise_type });
  revalidatePath("/train/exercises");
}

export async function updateExerciseAction(formData: FormData) {
  const id = str(formData, "id");
  const name = str(formData, "name");
  const category = str(formData, "category") || null;
  const exercise_type = str(formData, "exercise_type") as ExerciseType;
  await updateExercise({ id, name, category, exercise_type });
  revalidatePath("/train/exercises");
}

export async function archiveExerciseAction(formData: FormData) {
  const id = str(formData, "id");
  await archiveExercise(id);
  revalidatePath("/train/exercises");
}

export async function createRoutineAction(formData: FormData) {
  const name = str(formData, "name");
  const routine_type = str(formData, "routine_type") as RoutineType;
  const notes = str(formData, "notes") || null;
  await createRoutine({ name, routine_type, notes });
  revalidatePath("/train/routines");
}

export async function updateRoutineAction(formData: FormData) {
  const id = str(formData, "id");
  const name = str(formData, "name");
  const routine_type = str(formData, "routine_type") as RoutineType;
  const notes = str(formData, "notes") || null;
  await updateRoutine({ id, name, routine_type, notes });
  revalidatePath("/train/routines");
  revalidatePath(`/train/routines/${id}`);
}

export async function replaceRoutineExercisesAction(formData: FormData) {
  const routineId = str(formData, "routine_id");

  // items_json: [{exercise_id, exercise_order}]
  const itemsJson = str(formData, "items_json");
  const items = itemsJson ? (JSON.parse(itemsJson) as any[]) : [];

  await replaceRoutineExercises({
    routineId,
    items: items.map((it) => ({
      exercise_id: String(it.exercise_id),
      exercise_order: Number(it.exercise_order),
    })),
  });

  revalidatePath(`/train/routines/${routineId}`);
}

export async function startFreeSessionAction(formData: FormData) {
  const date = str(formData, "date");
  const title = str(formData, "title") || null;
  const session = await startFreeSession({ date, title });
  revalidatePath("/train");
  revalidatePath(`/train/session/${session.id}`);
  return session.id;
}

export async function startSessionFromRoutineAction(formData: FormData) {
  const date = str(formData, "date");
  const routineId = str(formData, "routine_id");
  const title = str(formData, "title") || null;
  const { session } = await startSessionFromRoutine({ date, routineId, title });
  revalidatePath("/train");
  revalidatePath(`/train/session/${session.id}`);
  return session.id;
}

export async function addExistingExerciseToSessionAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const exerciseId = str(formData, "exercise_id");
  await addExistingExerciseToSession({ sessionId, exerciseId, source_type: "extra" });
  revalidatePath(`/train/session/${sessionId}`);
}

export async function createExerciseFromSessionAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const name = str(formData, "name");
  const category = str(formData, "category") || null;
  const exercise_type = str(formData, "exercise_type") as ExerciseType;

  await createExerciseFromSession({ sessionId, name, category, exercise_type });
  revalidatePath(`/train/session/${sessionId}`);
  revalidatePath("/train/exercises");
}

export async function removeSessionExerciseAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const id = str(formData, "id");
  await removeSessionExercise(id);
  revalidatePath(`/train/session/${sessionId}`);
}

export async function upsertWorkoutSetAction(formData: FormData) {
  const sessionId = str(formData, "session_id");
  const workout_session_exercise_id = str(formData, "workout_session_exercise_id");
  const set_number = Number(str(formData, "set_number"));

  await upsertWorkoutSet({
    workout_session_exercise_id,
    set_number,
    reps: num(formData, "reps"),
    weight_kg: num(formData, "weight_kg"),
    rest_seconds: num(formData, "rest_seconds"),
    duration_seconds: num(formData, "duration_seconds"),
    distance_meters: num(formData, "distance_meters"),
    speed_kmh: num(formData, "speed_kmh"),
    incline_percent: num(formData, "incline_percent"),
    rpe: num(formData, "rpe"),
    notes: str(formData, "notes") || null,
  });

  revalidatePath(`/train/session/${sessionId}`);
}

