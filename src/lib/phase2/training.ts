import { createClient } from "@/lib/supabase/server";
import { getOrCreateDayLog } from "@/lib/phase1/day-log";
import type {
  Exercise,
  ExerciseType,
  Routine,
  RoutineExercise,
  RoutineType,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionExerciseSourceType,
  WorkoutSet,
} from "./types";

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return user.id;
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} es obligatorio.`);
}

export async function listExercises(params?: {
  includeArchived?: boolean;
}): Promise<Exercise[]> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  let q = supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (!params?.includeArchived) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Leer exercises: ${error.message}`);
  return (data ?? []) as Exercise[];
}

export async function createExercise(input: {
  name: string;
  category?: string | null;
  exercise_type: ExerciseType;
  default_sets?: number | null;
  default_reps?: number | null;
  default_rest_seconds?: number | null;
  default_weight_kg?: number | null;
  notes?: string | null;
}): Promise<Exercise> {
  assertNonEmpty(input.name, "Nombre");
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      category: input.category ?? null,
      exercise_type: input.exercise_type,
      default_sets: input.default_sets ?? null,
      default_reps: input.default_reps ?? null,
      default_rest_seconds: input.default_rest_seconds ?? null,
      default_weight_kg: input.default_weight_kg ?? null,
      notes: input.notes ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Crear exercise: ${error.message}`);
  return data as Exercise;
}

export async function updateExercise(input: {
  id: string;
  name?: string;
  category?: string | null;
  exercise_type?: ExerciseType;
  default_sets?: number | null;
  default_reps?: number | null;
  default_rest_seconds?: number | null;
  default_weight_kg?: number | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Exercise> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    assertNonEmpty(input.name, "Nombre");
    patch.name = input.name.trim();
  }
  if (input.category !== undefined) patch.category = input.category;
  if (input.exercise_type !== undefined) patch.exercise_type = input.exercise_type;
  if (input.default_sets !== undefined) patch.default_sets = input.default_sets;
  if (input.default_reps !== undefined) patch.default_reps = input.default_reps;
  if (input.default_rest_seconds !== undefined)
    patch.default_rest_seconds = input.default_rest_seconds;
  if (input.default_weight_kg !== undefined)
    patch.default_weight_kg = input.default_weight_kg;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("exercises")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`Editar exercise: ${error.message}`);
  return data as Exercise;
}

export async function archiveExercise(id: string): Promise<void> {
  await updateExercise({ id, is_active: false });
}

export async function listRoutines(params?: {
  includeArchived?: boolean;
}): Promise<Routine[]> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  let q = supabase
    .from("routines")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (!params?.includeArchived) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw new Error(`Leer routines: ${error.message}`);
  return (data ?? []) as Routine[];
}

export async function createRoutine(input: {
  name: string;
  routine_type: RoutineType;
  notes?: string | null;
}): Promise<Routine> {
  assertNonEmpty(input.name, "Nombre");
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      routine_type: input.routine_type,
      notes: input.notes ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Crear rutina: ${error.message}`);
  return data as Routine;
}

export async function updateRoutine(input: {
  id: string;
  name?: string;
  routine_type?: RoutineType;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Routine> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    assertNonEmpty(input.name, "Nombre");
    patch.name = input.name.trim();
  }
  if (input.routine_type !== undefined) patch.routine_type = input.routine_type;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("routines")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`Editar rutina: ${error.message}`);
  return data as Routine;
}

export async function listRoutineExercises(routineId: string): Promise<
  (RoutineExercise & {
    exercise: Pick<Exercise, "id" | "name" | "category" | "exercise_type">;
  })[]
> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("routine_exercises")
    .select(
      `
      *,
      exercise:exercises(id, name, category, exercise_type)
    `,
    )
    .eq("routine_id", routineId)
    .order("exercise_order", { ascending: true });

  if (error) throw new Error(`Leer routine_exercises: ${error.message}`);

  const rows = (data ?? []) as any[];
  for (const r of rows) {
    if (!r.exercise || typeof r.exercise.id !== "string") {
      throw new Error("Inconsistencia: routine_exercises sin exercise.");
    }
  }
  // RLS ya filtra por user (vía routine), pero agregamos check defensivo.
  // No podemos comparar user_id acá porque no viene en el join select.
  void userId;
  return rows as any;
}

export async function replaceRoutineExercises(input: {
  routineId: string;
  items: Array<{
    exercise_id: string;
    exercise_order: number;
    default_sets?: number | null;
    default_reps?: number | null;
    default_rest_seconds?: number | null;
    default_weight_kg?: number | null;
    default_duration_seconds?: number | null;
    default_distance_meters?: number | null;
    default_speed_kmh?: number | null;
    default_incline_percent?: number | null;
    notes?: string | null;
  }>;
}): Promise<void> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  // Asegura ownership de la rutina.
  const { data: routine, error: routineErr } = await supabase
    .from("routines")
    .select("id, user_id")
    .eq("id", input.routineId)
    .maybeSingle();
  if (routineErr) throw new Error(`Leer rutina: ${routineErr.message}`);
  if (!routine) throw new Error("Rutina no encontrada.");
  if (routine.user_id !== userId) throw new Error("Forbidden.");

  const { error: delErr } = await supabase
    .from("routine_exercises")
    .delete()
    .eq("routine_id", input.routineId);
  if (delErr) throw new Error(`Borrar routine_exercises: ${delErr.message}`);

  if (input.items.length === 0) return;

  const { error: insErr } = await supabase.from("routine_exercises").insert(
    input.items.map((it) => ({
      routine_id: input.routineId,
      exercise_id: it.exercise_id,
      exercise_order: it.exercise_order,
      default_sets: it.default_sets ?? null,
      default_reps: it.default_reps ?? null,
      default_rest_seconds: it.default_rest_seconds ?? null,
      default_weight_kg: it.default_weight_kg ?? null,
      default_duration_seconds: it.default_duration_seconds ?? null,
      default_distance_meters: it.default_distance_meters ?? null,
      default_speed_kmh: it.default_speed_kmh ?? null,
      default_incline_percent: it.default_incline_percent ?? null,
      notes: it.notes ?? null,
    })),
  );
  if (insErr) throw new Error(`Insert routine_exercises: ${insErr.message}`);
}

async function nextSessionOrder(dayLogId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("session_order")
    .eq("day_log_id", dayLogId)
    .order("session_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Leer workout_sessions: ${error.message}`);
  return (data?.session_order ?? 0) + 1;
}

export async function startFreeSession(input: {
  date: string;
  title?: string | null;
}): Promise<WorkoutSession> {
  const dayLog = await getOrCreateDayLog(input.date);
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const order = await nextSessionOrder(dayLog.id);

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      day_log_id: dayLog.id,
      base_routine_id: null,
      title: input.title ?? null,
      session_order: order,
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Crear workout_session: ${error.message}`);
  return data as WorkoutSession;
}

export async function startSessionFromRoutine(input: {
  date: string;
  routineId: string;
  title?: string | null;
}): Promise<{
  session: WorkoutSession;
  sessionExercises: WorkoutSessionExercise[];
}> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();
  const dayLog = await getOrCreateDayLog(input.date);

  const { data: routine, error: routineErr } = await supabase
    .from("routines")
    .select("*")
    .eq("id", input.routineId)
    .eq("user_id", userId)
    .single();
  if (routineErr) throw new Error(`Leer rutina: ${routineErr.message}`);

  const order = await nextSessionOrder(dayLog.id);

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      day_log_id: dayLog.id,
      base_routine_id: routine.id,
      title: input.title ?? routine.name,
      session_order: order,
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select("*")
    .single();
  if (sessErr) throw new Error(`Crear workout_session: ${sessErr.message}`);

  const { data: routineItems, error: itemsErr } = await supabase
    .from("routine_exercises")
    .select(
      `
      *,
      exercise:exercises(id, name, category, exercise_type)
    `,
    )
    .eq("routine_id", routine.id)
    .order("exercise_order", { ascending: true });
  if (itemsErr) throw new Error(`Leer routine_exercises: ${itemsErr.message}`);

  const inserts = (routineItems ?? []).map((it: any) => ({
    user_id: userId,
    workout_session_id: (session as any).id,
    routine_exercise_id: it.id as string,
    exercise_id: it.exercise.id as string,
    exercise_name_snapshot: it.exercise.name as string,
    category_snapshot: (it.exercise.category as string | null) ?? null,
    exercise_type_snapshot: it.exercise.exercise_type as ExerciseType,
    source_type: "routine" as WorkoutSessionExerciseSourceType,
    exercise_order: it.exercise_order as number,
    notes: it.notes ?? null,
  }));

  let sessionExercises: WorkoutSessionExercise[] = [];
  if (inserts.length > 0) {
    const { data: created, error: insErr } = await supabase
      .from("workout_session_exercises")
      .insert(inserts)
      .select("*");
    if (insErr)
      throw new Error(`Copiar ejercicios a sesión: ${insErr.message}`);
    sessionExercises = (created ?? []) as WorkoutSessionExercise[];
  }

  return { session: session as WorkoutSession, sessionExercises };
}

export async function getSession(sessionId: string): Promise<{
  session: WorkoutSession;
  exercises: WorkoutSessionExercise[];
}> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (sessErr) throw new Error(`Leer sesión: ${sessErr.message}`);

  const { data: exercises, error: exErr } = await supabase
    .from("workout_session_exercises")
    .select("*")
    .eq("workout_session_id", sessionId)
    .eq("user_id", userId)
    .order("exercise_order", { ascending: true });
  if (exErr) throw new Error(`Leer ejercicios de sesión: ${exErr.message}`);

  return { session: session as WorkoutSession, exercises: (exercises ?? []) as any };
}

export async function addExistingExerciseToSession(input: {
  sessionId: string;
  exerciseId: string;
  source_type?: WorkoutSessionExerciseSourceType;
}): Promise<WorkoutSessionExercise> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data: exercise, error: exErr } = await supabase
    .from("exercises")
    .select("id, name, category, exercise_type")
    .eq("id", input.exerciseId)
    .eq("user_id", userId)
    .single();
  if (exErr) throw new Error(`Leer exercise: ${exErr.message}`);

  const { data: last, error: lastErr } = await supabase
    .from("workout_session_exercises")
    .select("exercise_order")
    .eq("workout_session_id", input.sessionId)
    .eq("user_id", userId)
    .order("exercise_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`Leer orden de sesión: ${lastErr.message}`);

  const nextOrder = (last?.exercise_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("workout_session_exercises")
    .insert({
      user_id: userId,
      workout_session_id: input.sessionId,
      routine_exercise_id: null,
      exercise_id: exercise.id,
      exercise_name_snapshot: exercise.name,
      category_snapshot: exercise.category,
      exercise_type_snapshot: exercise.exercise_type,
      source_type: input.source_type ?? "extra",
      exercise_order: nextOrder,
      notes: null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Agregar ejercicio a sesión: ${error.message}`);
  return data as WorkoutSessionExercise;
}

export async function createExerciseFromSession(input: {
  sessionId: string;
  name: string;
  category?: string | null;
  exercise_type: ExerciseType;
}): Promise<{
  exercise: Exercise;
  sessionExercise: WorkoutSessionExercise;
}> {
  const exercise = await createExercise({
    name: input.name,
    category: input.category ?? null,
    exercise_type: input.exercise_type,
  });

  const sessionExercise = await addExistingExerciseToSession({
    sessionId: input.sessionId,
    exerciseId: exercise.id,
    source_type: "manual_new",
  });

  return { exercise, sessionExercise };
}

export async function removeSessionExercise(id: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { error } = await supabase
    .from("workout_session_exercises")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Borrar ejercicio de sesión: ${error.message}`);
}

export async function upsertWorkoutSet(input: {
  workout_session_exercise_id: string;
  set_number: number;
  reps?: number | null;
  weight_kg?: number | null;
  rest_seconds?: number | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  speed_kmh?: number | null;
  incline_percent?: number | null;
  rpe?: number | null;
  notes?: string | null;
}): Promise<WorkoutSet> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const payload = {
    user_id: userId,
    workout_session_exercise_id: input.workout_session_exercise_id,
    set_number: input.set_number,
    reps: input.reps ?? null,
    weight_kg: input.weight_kg ?? null,
    rest_seconds: input.rest_seconds ?? null,
    duration_seconds: input.duration_seconds ?? null,
    distance_meters: input.distance_meters ?? null,
    speed_kmh: input.speed_kmh ?? null,
    incline_percent: input.incline_percent ?? null,
    rpe: input.rpe ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("workout_sets")
    .upsert(payload, {
      onConflict: "workout_session_exercise_id,set_number",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Guardar set: ${error.message}`);
  return data as WorkoutSet;
}

export async function listSetsForSessionExercise(
  workoutSessionExerciseId: string,
): Promise<WorkoutSet[]> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("workout_session_exercise_id", workoutSessionExerciseId)
    .eq("user_id", userId)
    .order("set_number", { ascending: true });

  if (error) throw new Error(`Leer sets: ${error.message}`);
  return (data ?? []) as WorkoutSet[];
}

export async function listExerciseHistory(input: {
  exerciseId: string;
  limitSessions?: number;
}): Promise<
  Array<{
    session: WorkoutSession;
    day_log_date: string;
    sessionExercise: WorkoutSessionExercise;
    sets: WorkoutSet[];
  }>
> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const limitSessions = input.limitSessions ?? 20;

  // 1) Buscar ejecuciones (workout_session_exercises) para ese exercise.
  const { data: sessionExercises, error: seErr } = await supabase
    .from("workout_session_exercises")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_id", input.exerciseId)
    .order("created_at", { ascending: false })
    .limit(limitSessions);
  if (seErr) throw new Error(`Leer historial (session exercises): ${seErr.message}`);

  const rows = (sessionExercises ?? []) as WorkoutSessionExercise[];
  if (rows.length === 0) return [];

  const sessionIds = Array.from(new Set(rows.map((r) => r.workout_session_id)));

  // 2) Traer sesiones + day_log_id
  const { data: sessions, error: sErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .in("id", sessionIds);
  if (sErr) throw new Error(`Leer workout_sessions: ${sErr.message}`);

  const sessionsById = new Map<string, WorkoutSession>();
  for (const s of (sessions ?? []) as WorkoutSession[]) sessionsById.set(s.id, s);

  const dayLogIds = Array.from(
    new Set((sessions ?? []).map((s: any) => s.day_log_id as string)),
  );

  // 3) Traer day_logs para fechas
  const { data: dayLogs, error: dErr } = await supabase
    .from("day_logs")
    .select("id, log_date")
    .eq("user_id", userId)
    .in("id", dayLogIds);
  if (dErr) throw new Error(`Leer day_logs: ${dErr.message}`);

  const dayDateById = new Map<string, string>();
  for (const d of (dayLogs ?? []) as any[]) dayDateById.set(d.id, d.log_date);

  // 4) Traer sets de esas ejecuciones
  const wseIds = rows.map((r) => r.id);
  const { data: sets, error: setsErr } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("user_id", userId)
    .in("workout_session_exercise_id", wseIds)
    .order("set_number", { ascending: true });
  if (setsErr) throw new Error(`Leer workout_sets: ${setsErr.message}`);

  const setsByWse = new Map<string, WorkoutSet[]>();
  for (const st of (sets ?? []) as WorkoutSet[]) {
    const arr = setsByWse.get(st.workout_session_exercise_id) ?? [];
    arr.push(st);
    setsByWse.set(st.workout_session_exercise_id, arr);
  }

  // 5) Construir salida ordenada (por created_at desc de sessionExercise)
  return rows.map((se) => {
    const session = sessionsById.get(se.workout_session_id);
    if (!session) {
      throw new Error("Inconsistencia: sesión no encontrada para el historial.");
    }
    const dayDate = dayDateById.get(session.day_log_id);
    if (!dayDate) {
      throw new Error("Inconsistencia: day_log no encontrado para el historial.");
    }
    return {
      session,
      day_log_date: dayDate,
      sessionExercise: se,
      sets: setsByWse.get(se.id) ?? [],
    };
  });
}

