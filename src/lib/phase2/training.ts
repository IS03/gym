import { createClient } from "@/lib/supabase/server";
import { getOrCreateDayLog } from "@/lib/phase1/day-log";
import type {
  Exercise,
  MuscleGroup,
  Routine,
  RoutineExercise,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionStatus,
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

function asPostgrestError(err: unknown): { code?: string; message?: string } {
  if (typeof err !== "object" || err === null) return {};
  const anyErr = err as any;
  return {
    code: typeof anyErr.code === "string" ? anyErr.code : undefined,
    message: typeof anyErr.message === "string" ? anyErr.message : undefined,
  };
}

const MSG_SESSION_IN_PROGRESS =
  "Ya tenés una sesión de entrenamiento en curso. Continuá esa sesión o finalizala antes de iniciar otra.";

async function getWorkoutSessionForOwner(sessionId: string): Promise<WorkoutSession> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Leer sesión: ${error.message}`);
  if (!data) throw new Error("Sesión no encontrada.");
  if ((data as WorkoutSession).user_id !== userId) {
    throw new Error("Forbidden.");
  }
  return data as WorkoutSession;
}

async function requireSessionInProgress(sessionId: string): Promise<void> {
  const s = await getWorkoutSessionForOwner(sessionId);
  if (s.status !== "in_progress") {
    throw new Error("La sesión ya finalizó. No se puede modificar.");
  }
}

export async function getInProgressSessionForUser(): Promise<{
  session: WorkoutSession;
  log_date: string;
} | null> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();
  const { data: session, error: sErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (sErr) throw new Error(`Buscar sesión en curso: ${sErr.message}`);
  if (!session) return null;
  const { data: dayLog, error: dErr } = await supabase
    .from("day_logs")
    .select("log_date")
    .eq("id", (session as WorkoutSession).day_log_id)
    .single();
  if (dErr) throw new Error(`Leer día de la sesión: ${dErr.message}`);
  return {
    session: session as WorkoutSession,
    log_date: String((dayLog as { log_date: string }).log_date),
  };
}

function normalizeNameLocal(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function listExercises(params?: {
  includeArchived?: boolean;
  muscleGroup?: MuscleGroup | "none";
}): Promise<Exercise[]> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  let q = supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .order("nombre", { ascending: true });

  if (!params?.includeArchived) {
    q = q.eq("is_active", true);
  }
  if (params?.muscleGroup) {
    if (params.muscleGroup === "none") {
      q = q.is("grupo_muscular", null);
    } else {
      q = q.eq("grupo_muscular", params.muscleGroup);
    }
  }

  const { data, error } = await q;
  if (error) throw new Error(`Leer exercises: ${error.message}`);
  return (data ?? []) as Exercise[];
}

export async function listTrainingDaysInMonth(input: {
  month: `${number}-${number}`; // YYYY-MM
  routineId?: string | null;
}): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  await getAuthedUserId();

  const start = `${input.month}-01`;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
  const end = endDate.toISOString().slice(0, 10);

  let q = supabase
    .from("workout_sessions")
    .select("id, ended_at, routine_id, routine:routines(color), day_log:day_logs(log_date)")
    .eq("status", "completed")
    .not("ended_at", "is", null)
    .gte("day_logs.log_date", start)
    .lt("day_logs.log_date", end);

  if (input.routineId) q = q.eq("routine_id", input.routineId);

  const { data, error } = await q;
  if (error) throw new Error(`Leer días entrenados: ${error.message}`);

  const out = new Map<string, Set<string>>();
  for (const row of (data ?? []) as any[]) {
    const date = row.day_log?.log_date ? String(row.day_log.log_date) : null;
    if (!date) continue;
    const color = row.routine?.color ? String(row.routine.color) : "#0f172a";
    const set = out.get(date) ?? new Set<string>();
    set.add(color);
    out.set(date, set);
  }
  return new Map(Array.from(out.entries()).map(([k, v]) => [k, Array.from(v)]));
}

export async function listEndedSessionsByDate(input: {
  date: string; // YYYY-MM-DD
  routineId?: string | null;
}): Promise<
  Array<{
    session: WorkoutSession;
    routineNombre: string | null;
    exercisesCount: number;
    completedCount: number;
  }>
> {
  const supabase = await createClient();
  await getAuthedUserId();

  // Get day_log id for date (must exist if you trained)
  const { data: dayLog, error: dayErr } = await supabase
    .from("day_logs")
    .select("id, log_date")
    .eq("log_date", input.date)
    .maybeSingle();
  if (dayErr) throw new Error(`Leer day_log: ${dayErr.message}`);
  if (!dayLog) return [];

  let q = supabase
    .from("workout_sessions")
    .select("*, routine:routines(nombre)")
    .eq("day_log_id", dayLog.id)
    .eq("status", "completed")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false });

  if (input.routineId) q = q.eq("routine_id", input.routineId);

  const { data: sessions, error: sErr } = await q;
  if (sErr) throw new Error(`Leer sesiones: ${sErr.message}`);

  const ids = (sessions ?? []).map((s: any) => s.id as string);
  if (ids.length === 0) return [];

  const { data: ses, error: seErr } = await supabase
    .from("workout_session_exercises")
    .select("workout_session_id, is_completed")
    .in("workout_session_id", ids);
  if (seErr) throw new Error(`Leer ejercicios de sesión: ${seErr.message}`);

  const agg = new Map<string, { total: number; done: number }>();
  for (const r of (ses ?? []) as any[]) {
    const id = String(r.workout_session_id);
    const prev = agg.get(id) ?? { total: 0, done: 0 };
    prev.total += 1;
    if (r.is_completed) prev.done += 1;
    agg.set(id, prev);
  }

  return (sessions ?? []).map((s: any) => {
    const a = agg.get(String(s.id)) ?? { total: 0, done: 0 };
    return {
      session: s as WorkoutSession,
      routineNombre: s.routine?.nombre ?? null,
      exercisesCount: a.total,
      completedCount: a.done,
    };
  });
}

export async function createExercise(input: {
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  series_sugeridas: number | null;
  reps_sugeridas: number | null;
  peso_sugerido: number | null;
}): Promise<Exercise> {
  assertNonEmpty(input.nombre, "Nombre");
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      nombre: input.nombre.trim(),
      grupo_muscular: input.grupo_muscular,
      series_sugeridas: input.series_sugeridas,
      reps_sugeridas: input.reps_sugeridas,
      peso_sugerido: input.peso_sugerido,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error("Ya existe un ejercicio con ese nombre.");
    }
    throw new Error(`Crear exercise: ${error.message}`);
  }
  return data as Exercise;
}

export async function updateExercise(input: {
  id: string;
  nombre?: string;
  grupo_muscular?: MuscleGroup | null;
  series_sugeridas?: number | null;
  reps_sugeridas?: number | null;
  peso_sugerido?: number | null;
  is_active?: boolean;
}): Promise<Exercise> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const patch: Record<string, unknown> = {};
  if (input.nombre !== undefined) {
    assertNonEmpty(input.nombre, "Nombre");
    patch.nombre = input.nombre.trim();
  }
  if (input.grupo_muscular !== undefined)
    patch.grupo_muscular = input.grupo_muscular;
  if (input.series_sugeridas !== undefined) patch.series_sugeridas = input.series_sugeridas;
  if (input.reps_sugeridas !== undefined) patch.reps_sugeridas = input.reps_sugeridas;
  if (input.peso_sugerido !== undefined) patch.peso_sugerido = input.peso_sugerido;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("exercises")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error("Ya existe un ejercicio con ese nombre.");
    }
    throw new Error(`Editar exercise: ${error.message}`);
  }
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
    .order("nombre", { ascending: true });

  if (!params?.includeArchived) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) throw new Error(`Leer routines: ${error.message}`);
  return (data ?? []) as Routine[];
}

export async function createRoutine(input: {
  nombre: string;
  color?: string | null;
}): Promise<Routine> {
  assertNonEmpty(input.nombre, "Nombre");
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      nombre: input.nombre.trim(),
      color: input.color ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error("Ya existe una rutina con ese nombre.");
    }
    throw new Error(`Crear rutina: ${error.message}`);
  }
  return data as Routine;
}

export async function updateRoutine(input: {
  id: string;
  nombre?: string;
  color?: string | null;
  is_active?: boolean;
}): Promise<Routine> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const patch: Record<string, unknown> = {};
  if (input.nombre !== undefined) {
    assertNonEmpty(input.nombre, "Nombre");
    patch.nombre = input.nombre.trim();
  }
  if (input.color !== undefined) patch.color = input.color;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const { data, error } = await supabase
    .from("routines")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error("Ya existe una rutina con ese nombre.");
    }
    throw new Error(`Editar rutina: ${error.message}`);
  }
  return data as Routine;
}

export async function listRoutineExercises(routineId: string): Promise<
  (RoutineExercise & {
    exercise: Pick<Exercise, "id" | "nombre" | "grupo_muscular">;
  })[]
> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  const { data, error } = await supabase
    .from("routine_exercises")
    .select(
      `
      *,
      exercise:exercises(id, nombre, grupo_muscular)
    `,
    )
    .eq("routine_id", routineId)
    .order("created_at", { ascending: true });

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
    })),
  );
  if (insErr) throw new Error(`Insert routine_exercises: ${insErr.message}`);
}

export async function addExerciseToRoutine(input: {
  routineId: string;
  exerciseId: string;
}): Promise<RoutineExercise> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();

  // Validar ownership de rutina y exercise (defensivo; triggers/RLS también protegen)
  const { data: routine, error: routineErr } = await supabase
    .from("routines")
    .select("id, user_id")
    .eq("id", input.routineId)
    .maybeSingle();
  if (routineErr) throw new Error(`Leer rutina: ${routineErr.message}`);
  if (!routine) throw new Error("Rutina no encontrada.");
  if (routine.user_id !== userId) throw new Error("Forbidden.");

  const { data: exercise, error: exErr } = await supabase
    .from("exercises")
    .select("id, user_id")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (exErr) throw new Error(`Leer exercise: ${exErr.message}`);
  if (!exercise) throw new Error("Ejercicio no encontrado.");
  if (exercise.user_id !== userId) throw new Error("Forbidden.");

  const { data, error } = await supabase
    .from("routine_exercises")
    .insert({
      routine_id: input.routineId,
      exercise_id: input.exerciseId,
    })
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error("Ese ejercicio ya está en la rutina.");
    }
    throw new Error(`Agregar ejercicio a rutina: ${error.message}`);
  }

  return data as RoutineExercise;
}

export async function removeRoutineExercise(input: {
  routineExerciseId: string;
}): Promise<void> {
  const supabase = await createClient();
  await getAuthedUserId();

  const { error } = await supabase
    .from("routine_exercises")
    .delete()
    .eq("id", input.routineExerciseId);

  if (error) throw new Error(`Quitar ejercicio de rutina: ${error.message}`);
}

export async function startFreeSession(input: {
  date: string;
}): Promise<WorkoutSession> {
  const dayLog = await getOrCreateDayLog(input.date);
  const supabase = await createClient();
  await getAuthedUserId();

  const existing = await getInProgressSessionForUser();
  if (existing) {
    throw new Error(MSG_SESSION_IN_PROGRESS);
  }

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      day_log_id: dayLog.id,
      user_id: dayLog.user_id,
      routine_id: null,
      status: "in_progress" as WorkoutSessionStatus,
    })
    .select("*")
    .single();

  if (error) {
    const { code } = asPostgrestError(error);
    if (code === "23505") {
      throw new Error(MSG_SESSION_IN_PROGRESS);
    }
    throw new Error(`Crear workout_session: ${error.message}`);
  }
  return data as WorkoutSession;
}

export async function startSessionFromRoutine(input: {
  date: string;
  routineId: string;
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

  const existing = await getInProgressSessionForUser();
  if (existing) {
    throw new Error(MSG_SESSION_IN_PROGRESS);
  }

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .insert({
      day_log_id: dayLog.id,
      user_id: dayLog.user_id,
      routine_id: routine.id,
      status: "in_progress" as WorkoutSessionStatus,
    })
    .select("*")
    .single();
  if (sessErr) {
    const { code } = asPostgrestError(sessErr);
    if (code === "23505") {
      throw new Error(MSG_SESSION_IN_PROGRESS);
    }
    throw new Error(`Crear workout_session: ${sessErr.message}`);
  }

  const { data: routineItems, error: itemsErr } = await supabase
    .from("routine_exercises")
    .select(
      `
      *,
      exercise:exercises(id, nombre, grupo_muscular)
    `,
    )
    .eq("routine_id", routine.id)
    .order("created_at", { ascending: true });
  if (itemsErr) throw new Error(`Leer routine_exercises: ${itemsErr.message}`);

  const inserts = (routineItems ?? []).map((it: any) => ({
    workout_session_id: (session as any).id,
    exercise_id: it.exercise.id as string,
    nombre_snapshot: it.exercise.nombre as string,
    grupo_muscular_snapshot: (it.exercise.grupo_muscular as MuscleGroup | null) ?? null,
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
  await getAuthedUserId();

  const { data: session, error: sessErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sessErr) throw new Error(`Leer sesión: ${sessErr.message}`);

  const { data: exercises, error: exErr } = await supabase
    .from("workout_session_exercises")
    .select("*")
    .eq("workout_session_id", sessionId)
    .order("created_at", { ascending: true });
  if (exErr) throw new Error(`Leer ejercicios de sesión: ${exErr.message}`);

  return { session: session as WorkoutSession, exercises: (exercises ?? []) as any };
}

export async function finishSession(sessionId: string): Promise<WorkoutSession> {
  const supabase = await createClient();
  await requireSessionInProgress(sessionId);

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed" as WorkoutSessionStatus,
      ended_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) throw new Error(`Terminar sesión: ${error.message}`);
  return data as WorkoutSession;
}

export async function addExistingExerciseToSession(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<WorkoutSessionExercise> {
  const supabase = await createClient();
  const userId = await getAuthedUserId();
  await requireSessionInProgress(input.sessionId);

  const { data: exercise, error: exErr } = await supabase
    .from("exercises")
    .select("id, nombre, grupo_muscular")
    .eq("id", input.exerciseId)
    .eq("user_id", userId)
    .single();
  if (exErr) throw new Error(`Leer exercise: ${exErr.message}`);

  const { data, error } = await supabase
    .from("workout_session_exercises")
    .insert({
      workout_session_id: input.sessionId,
      exercise_id: exercise.id,
      nombre_snapshot: exercise.nombre,
      grupo_muscular_snapshot: exercise.grupo_muscular,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Agregar ejercicio a sesión: ${error.message}`);
  return data as WorkoutSessionExercise;
}

export async function createExerciseFromSession(input: {
  sessionId: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  series_sugeridas: number | null;
  reps_sugeridas: number | null;
  peso_sugerido: number | null;
}): Promise<{
  exercise: Exercise;
  sessionExercise: WorkoutSessionExercise;
}> {
  await requireSessionInProgress(input.sessionId);
  // Chequeo previo para avisar sin depender del unique error.
  const supabase = await createClient();
  const userId = await getAuthedUserId();
  const nombreNorm = normalizeNameLocal(input.nombre);

  const { data: existing, error: existingErr } = await supabase
    .from("exercises")
    .select("id")
    .eq("user_id", userId)
    .ilike("nombre", nombreNorm)
    .limit(1)
    .maybeSingle();
  if (existingErr) throw new Error(`Validar exercise existente: ${existingErr.message}`);
  if (existing) {
    throw new Error("Ya existe un ejercicio con ese nombre.");
  }

  const exercise = await createExercise({
    nombre: nombreNorm,
    grupo_muscular: input.grupo_muscular,
    series_sugeridas: input.series_sugeridas,
    reps_sugeridas: input.reps_sugeridas,
    peso_sugerido: input.peso_sugerido,
  });

  const sessionExercise = await addExistingExerciseToSession({
    sessionId: input.sessionId,
    exerciseId: exercise.id,
  });

  return { exercise, sessionExercise };
}

export async function removeSessionExercise(id: string): Promise<void> {
  const supabase = await createClient();
  await getAuthedUserId();

  const { data: row, error: rErr } = await supabase
    .from("workout_session_exercises")
    .select("workout_session_id")
    .eq("id", id)
    .single();
  if (rErr) throw new Error(`Leer ejercicio de sesión: ${rErr.message}`);
  await requireSessionInProgress((row as { workout_session_id: string }).workout_session_id);

  const { error } = await supabase
    .from("workout_session_exercises")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Borrar ejercicio de sesión: ${error.message}`);
}

export async function updateSessionExercise(input: {
  id: string;
  series_reales?: number | null;
  reps_reales?: number | null;
  peso_real?: number | null;
  is_completed?: boolean;
}): Promise<WorkoutSessionExercise> {
  const supabase = await createClient();
  await getAuthedUserId();

  const { data: row, error: rErr } = await supabase
    .from("workout_session_exercises")
    .select("workout_session_id")
    .eq("id", input.id)
    .single();
  if (rErr) throw new Error(`Leer ejercicio de sesión: ${rErr.message}`);
  await requireSessionInProgress((row as { workout_session_id: string }).workout_session_id);

  const patch: Record<string, unknown> = {};
  if (input.series_reales !== undefined) patch.series_reales = input.series_reales;
  if (input.reps_reales !== undefined) patch.reps_reales = input.reps_reales;
  if (input.peso_real !== undefined) patch.peso_real = input.peso_real;
  if (input.is_completed !== undefined) patch.is_completed = input.is_completed;

  const { data, error } = await supabase
    .from("workout_session_exercises")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw new Error(`Editar ejercicio de sesión: ${error.message}`);
  return data as WorkoutSessionExercise;
}

export async function listExerciseHistory(input: {
  exerciseId: string;
  limitSessions?: number;
}): Promise<
  Array<{
    session: WorkoutSession;
    day_log_date: string;
    sessionExercise: WorkoutSessionExercise;
  }>
> {
  const supabase = await createClient();
  await getAuthedUserId();

  const limitSessions = input.limitSessions ?? 20;

  // 1) Buscar ejecuciones (workout_session_exercises) para ese exercise.
  const { data: sessionExercises, error: seErr } = await supabase
    .from("workout_session_exercises")
    .select("*")
    .eq("exercise_id", input.exerciseId)
    .order("created_at", { ascending: false })
    .limit(limitSessions);
  if (seErr) throw new Error(`Leer historial (session exercises): ${seErr.message}`);

  const rows = (sessionExercises ?? []) as WorkoutSessionExercise[];
  if (rows.length === 0) return [];

  const sessionIds = Array.from(new Set(rows.map((r) => r.workout_session_id)));

  // 2) Traer sesiones + day_log_id (solo finalizadas cuentan como historial)
  const { data: sessions, error: sErr } = await supabase
    .from("workout_sessions")
    .select("*")
    .in("id", sessionIds)
    .eq("status", "completed");
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
    .in("id", dayLogIds);
  if (dErr) throw new Error(`Leer day_logs: ${dErr.message}`);

  const dayDateById = new Map<string, string>();
  for (const d of (dayLogs ?? []) as any[]) dayDateById.set(d.id, d.log_date);

  const completedRows = rows.filter((se) => sessionsById.has(se.workout_session_id));

  // 5) Construir salida ordenada (por created_at desc de sessionExercise)
  return completedRows.map((se) => {
    const session = sessionsById.get(se.workout_session_id)!;
    const dayDate = dayDateById.get(session.day_log_id);
    if (!dayDate) {
      throw new Error("Inconsistencia: day_log no encontrado para el historial.");
    }
    return {
      session,
      day_log_date: dayDate,
      sessionExercise: se,
    };
  });
}

