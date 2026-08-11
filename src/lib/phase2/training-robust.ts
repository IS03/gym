import "server-only";

import { getOrCreateDayLog } from "@/lib/phase1/day-log";
import { createClient } from "@/lib/supabase/server";
import { todayInCordoba } from "./cordoba-date";
import { INITIAL_TRAINING_PLAN } from "./initial-plan";
import { buildWeeklyTrainingSummaries } from "./training-progress-summary";
import {
  validateRoutineExercisePayload,
  validateSessionMetadata,
  validateWorkoutExercisePayload,
} from "./training-validation";
import type {
  EditableWorkoutSet,
  ExerciseProgressSummary,
  Routine,
  RoutineExercisePayload,
  RoutineExerciseSet,
  RoutineExerciseTemplate,
  SessionMetadataInput,
  WeeklyTrainingSummary,
  WorkoutExercisePayload,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSessionExercise,
  WorkoutSessionExerciseDetail,
  WorkoutSet,
} from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ErrorLike = {
  code?: string;
  message?: string;
};

function errorLike(value: unknown): ErrorLike {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label}: respuesta inválida de la base.`);
  }
  return value;
}

async function getAuthedContext(): Promise<{
  supabase: SupabaseServerClient;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Autenticación: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

function throwRpcError(label: string, value: unknown): never {
  const { code, message } = errorLike(value);
  if (code === "40001") {
    throw new Error(
      "Este ejercicio cambió en otro dispositivo. Recargá la sesión antes de guardar.",
    );
  }
  throw new Error(`${label}: ${message ?? "error inesperado."}`);
}

export { todayInCordoba } from "./cordoba-date";

export async function getInitialPlanStatus(): Promise<{
  imported: boolean;
  routinesFound: number;
}> {
  const { supabase, userId } = await getAuthedContext();
  const keys = INITIAL_TRAINING_PLAN.routines.map((routine) => routine.source_key);
  const { data, error } = await supabase
    .from("routines")
    .select("source_key")
    .eq("user_id", userId)
    .in("source_key", keys);
  if (error) throw new Error(`Revisar plan inicial: ${error.message}`);
  const found = new Set(
    ((data ?? []) as Array<{ source_key: string | null }>)
      .map((row) => row.source_key)
      .filter((key): key is string => Boolean(key)),
  );
  return { imported: keys.every((key) => found.has(key)), routinesFound: found.size };
}

export async function importInitialTrainingPlan(): Promise<{
  routines: number;
  exercises: number;
}> {
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("import_training_plan", {
    p_plan: INITIAL_TRAINING_PLAN,
  });
  if (error) throwRpcError("Importar rutinas", error);
  if (typeof data !== "object" || data === null) {
    throw new Error("Importar rutinas: respuesta inválida de la base.");
  }
  const result = data as Record<string, unknown>;
  return {
    routines: Number(result.routines ?? 0),
    exercises: Number(result.exercises ?? 0),
  };
}

type RawRoutineExercise = Omit<RoutineExerciseTemplate, "exercise" | "sets"> & {
  exercise:
    | RoutineExerciseTemplate["exercise"]
    | RoutineExerciseTemplate["exercise"][]
    | null;
  sets: RoutineExerciseSet[] | null;
};

export async function getRoutineTemplate(routineId: string): Promise<{
  routine: Routine;
  exercises: RoutineExerciseTemplate[];
}> {
  const { supabase, userId } = await getAuthedContext();
  const [{ data: routine, error: routineError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("routines")
        .select("*")
        .eq("id", routineId)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("routine_exercises")
        .select(
          `
            *,
            exercise:exercises(
              id,
              nombre,
              grupo_muscular,
              muscle_group_label,
              implement,
              weight_mode,
              is_active
            ),
            sets:routine_exercise_sets(*)
          `,
        )
        .eq("routine_id", routineId)
        .order("exercise_order", { ascending: true }),
    ]);

  if (routineError) throw new Error(`Leer rutina: ${routineError.message}`);
  if (itemsError) throw new Error(`Leer objetivos: ${itemsError.message}`);

  const exercises = ((items ?? []) as RawRoutineExercise[]).map((row) => {
    const exercise = firstRelation(row.exercise);
    if (!exercise) throw new Error("La rutina contiene un ejercicio inexistente.");
    return {
      ...row,
      exercise,
      sets: [...(row.sets ?? [])].sort((a, b) => a.set_number - b.set_number),
    };
  });

  return { routine: routine as Routine, exercises };
}

export async function saveRoutineExerciseTarget(input: {
  routineExerciseId: string;
  payload: RoutineExercisePayload;
}): Promise<string> {
  validateRoutineExercisePayload(input.payload);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("save_routine_exercise", {
    p_routine_exercise_id: input.routineExerciseId,
    p_payload: input.payload,
  });
  if (error) throwRpcError("Guardar objetivo", error);
  if (typeof data !== "string") {
    throw new Error("Guardar objetivo: respuesta inválida de la base.");
  }
  return data;
}

export async function moveRoutineExerciseTarget(input: {
  routineExerciseId: string;
  direction: -1 | 1;
}) {
  const { supabase } = await getAuthedContext();
  const { error } = await supabase.rpc("move_routine_exercise", {
    p_routine_exercise_id: input.routineExerciseId,
    p_direction: input.direction,
  });
  if (error) throwRpcError("Mover ejercicio", error);
}

export async function startWorkoutSession(input: {
  date: string;
  routineId: string | null;
}): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("La fecha no es válida.");
  }
  const dayLog = await getOrCreateDayLog(input.date);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("start_workout_session", {
    p_day_log_id: dayLog.id,
    p_routine_id: input.routineId,
  });
  if (error) throwRpcError("Iniciar sesión", error);
  return requireUuid(data, "Iniciar sesión");
}

export async function appendWorkoutExercise(input: {
  sessionId: string;
  exerciseId: string;
}): Promise<string> {
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("append_workout_exercise", {
    p_session_id: input.sessionId,
    p_exercise_id: input.exerciseId,
    p_source_type: "extra",
  });
  if (error) throwRpcError("Agregar ejercicio", error);
  return requireUuid(data, "Agregar ejercicio");
}

type RawSessionExercise = WorkoutSessionExercise & {
  sets: WorkoutSet[] | null;
};

export async function getWorkoutSessionDetail(
  sessionId: string,
): Promise<WorkoutSessionDetail> {
  const { supabase, userId } = await getAuthedContext();
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (sessionError) throw new Error(`Leer sesión: ${sessionError.message}`);

  const typedSession = session as WorkoutSession;
  const [{ data: dayLog, error: dayError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase
        .from("day_logs")
        .select("log_date")
        .eq("id", typedSession.day_log_id)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("workout_session_exercises")
        .select("*, sets:workout_sets(*)")
        .eq("workout_session_id", sessionId)
        .eq("user_id", userId)
        .order("exercise_order", { ascending: true }),
    ]);
  if (dayError) throw new Error(`Leer fecha de sesión: ${dayError.message}`);
  if (rowsError) throw new Error(`Leer ejercicios de sesión: ${rowsError.message}`);

  const exercises: WorkoutSessionExerciseDetail[] = (
    (rows ?? []) as RawSessionExercise[]
  ).map((row) => ({
    ...row,
    sets: [...(row.sets ?? [])].sort((a, b) => a.set_number - b.set_number),
  }));

  return {
    session: typedSession,
    logDate: String((dayLog as { log_date: string }).log_date),
    exercises,
  };
}

export async function saveWorkoutExercise(input: {
  sessionExerciseId: string;
  expectedUpdatedAt: string;
  payload: WorkoutExercisePayload;
}): Promise<string> {
  validateWorkoutExercisePayload(input.payload);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("save_workout_exercise", {
    p_session_exercise_id: input.sessionExerciseId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_payload: input.payload,
  });
  if (error) throwRpcError("Guardar ejercicio", error);
  if (typeof data !== "string") {
    throw new Error("Guardar ejercicio: respuesta inválida de la base.");
  }
  return data;
}

export async function finishWorkoutSession(input: {
  sessionId: string;
  metadata: SessionMetadataInput;
}): Promise<string> {
  validateSessionMetadata(input.metadata);
  const { supabase } = await getAuthedContext();
  const { data, error } = await supabase.rpc("finish_workout_session", {
    p_session_id: input.sessionId,
    p_metadata: input.metadata,
  });
  if (error) throwRpcError("Finalizar sesión", error);
  return requireUuid(data, "Finalizar sesión");
}

export async function cancelWorkoutSession(sessionId: string) {
  const { supabase, userId } = await getAuthedContext();
  const { data, error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Cancelar sesión: ${error.message}`);
  if (!data) throw new Error("La sesión no existe o ya fue finalizada.");
}

export type RobustExerciseHistoryItem = {
  session: WorkoutSession;
  logDate: string;
  exercise: WorkoutSessionExerciseDetail;
};

export async function listRobustExerciseHistory(input: {
  exerciseId: string;
  fromDate?: string;
  routineId?: string;
  limit?: number;
}): Promise<RobustExerciseHistoryItem[]> {
  const { supabase, userId } = await getAuthedContext();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  let daysQuery = supabase
    .from("day_logs")
    .select("id, log_date")
    .eq("user_id", userId)
    .order("log_date", { ascending: false })
    .limit(500);
  if (input.fromDate) daysQuery = daysQuery.gte("log_date", input.fromDate);
  const { data: rawDays, error: daysError } = await daysQuery;
  if (daysError) throw new Error(`Leer fechas históricas: ${daysError.message}`);
  const days = (rawDays ?? []) as Array<{ id: string; log_date: string }>;
  if (days.length === 0) return [];

  let sessionsQuery = supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("day_log_id", days.map((day) => day.id))
    .order("ended_at", { ascending: false })
    .limit(500);
  if (input.routineId) sessionsQuery = sessionsQuery.eq("routine_id", input.routineId);
  const { data: rawSessions, error: sessionError } = await sessionsQuery;
  if (sessionError) throw new Error(`Leer sesiones históricas: ${sessionError.message}`);
  const sessions = (rawSessions ?? []) as WorkoutSession[];
  if (sessions.length === 0) return [];

  const { data: rawExercises, error: exerciseError } = await supabase
    .from("workout_session_exercises")
    .select("*, sets:workout_sets(*)")
    .eq("user_id", userId)
    .eq("exercise_id", input.exerciseId)
    .eq("is_completed", true)
    .in("workout_session_id", sessions.map((session) => session.id));
  if (exerciseError) throw new Error(`Leer historial del ejercicio: ${exerciseError.message}`);

  const exercises = ((rawExercises ?? []) as RawSessionExercise[]).map((row) => ({
    ...row,
    sets: [...(row.sets ?? [])].sort((a, b) => a.set_number - b.set_number),
  }));
  if (exercises.length === 0) return [];

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const dateByDayLog = new Map(days.map((day) => [day.id, day.log_date]));

  return exercises
    .flatMap((exercise): RobustExerciseHistoryItem[] => {
      const session = sessionById.get(exercise.workout_session_id);
      if (!session) return [];
      const logDate = dateByDayLog.get(session.day_log_id);
      if (!logDate) return [];
      return [{ session, logDate, exercise }];
    })
    .sort((left, right) => right.logDate.localeCompare(left.logDate))
    .slice(0, limit);
}

export async function listRobustExerciseHistoryRoutineOptions(exerciseId: string) {
  const items = await listRobustExerciseHistory({ exerciseId, limit: 100 });
  const routines = new Map<string, { id: string; nombre: string }>();
  for (const item of items) {
    if (!item.session.routine_id) continue;
    routines.set(item.session.routine_id, {
      id: item.session.routine_id,
      nombre: item.session.routine_name_snapshot ?? item.session.session_name ?? "Rutina",
    });
  }
  return [...routines.values()].sort((left, right) => left.nombre.localeCompare(right.nombre, "es-AR"));
}

type CompletedTrainingData = {
  sessions: WorkoutSession[];
  sessionExercises: WorkoutSessionExercise[];
  sets: WorkoutSet[];
  dateByDayLog: Map<string, string>;
};

async function loadCompletedTrainingData(): Promise<CompletedTrainingData> {
  const { supabase, userId } = await getAuthedContext();
  const { data: rawSessions, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(500);
  if (sessionError) throw new Error(`Leer progreso: ${sessionError.message}`);

  const sessions = (rawSessions ?? []) as WorkoutSession[];
  if (sessions.length === 0) {
    return {
      sessions: [],
      sessionExercises: [],
      sets: [],
      dateByDayLog: new Map(),
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const dayLogIds = [...new Set(sessions.map((session) => session.day_log_id))];
  const [{ data: rawExercises, error: exerciseError }, { data: rawDays, error: daysError }] =
    await Promise.all([
      supabase
        .from("workout_session_exercises")
        .select("*")
        .eq("user_id", userId)
        .in("workout_session_id", sessionIds),
      supabase
        .from("day_logs")
        .select("id, log_date")
        .eq("user_id", userId)
        .in("id", dayLogIds),
    ]);
  if (exerciseError) throw new Error(`Leer ejercicios de progreso: ${exerciseError.message}`);
  if (daysError) throw new Error(`Leer fechas de progreso: ${daysError.message}`);

  const sessionExercises = (rawExercises ?? []) as WorkoutSessionExercise[];
  let sets: WorkoutSet[] = [];
  if (sessionExercises.length > 0) {
    const { data: rawSets, error: setsError } = await supabase
      .from("workout_sets")
      .select("*")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .in(
        "workout_session_exercise_id",
        sessionExercises.map((exercise) => exercise.id),
      );
    if (setsError) throw new Error(`Leer series de progreso: ${setsError.message}`);
    sets = (rawSets ?? []) as WorkoutSet[];
  }

  return {
    sessions,
    sessionExercises,
    sets,
    dateByDayLog: new Map(
      ((rawDays ?? []) as Array<{ id: string; log_date: string }>).map((day) => [
        day.id,
        day.log_date,
      ]),
    ),
  };
}

export { mondayOfIsoDate } from "./training-progress-summary";

function workoutSetVolume(set: WorkoutSet): number {
  return (set.actual_reps ?? 0) * (set.actual_weight_kg ?? 0);
}

export async function getTrainingProgress(): Promise<{
  weeks: WeeklyTrainingSummary[];
  exercises: ExerciseProgressSummary[];
}> {
  const data = await loadCompletedTrainingData();
  const sessionById = new Map(data.sessions.map((session) => [session.id, session]));
  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const set of data.sets) {
    const current = setsByExercise.get(set.workout_session_exercise_id) ?? [];
    current.push(set);
    setsByExercise.set(set.workout_session_exercise_id, current);
  }
  for (const sets of setsByExercise.values()) {
    sets.sort((left, right) => left.set_number - right.set_number);
  }

  const weeks = buildWeeklyTrainingSummaries(data, todayInCordoba());

  const groupedByCatalogExercise = new Map<string, WorkoutSessionExercise[]>();
  for (const exercise of data.sessionExercises) {
    if (!exercise.is_completed) continue;
    const current = groupedByCatalogExercise.get(exercise.exercise_id) ?? [];
    current.push(exercise);
    groupedByCatalogExercise.set(exercise.exercise_id, current);
  }

  const exerciseProgress: ExerciseProgressSummary[] = [];
  for (const [exerciseId, history] of groupedByCatalogExercise) {
    const dated = history
      .flatMap((exercise) => {
        const session = sessionById.get(exercise.workout_session_id);
        if (!session) return [];
        const date = data.dateByDayLog.get(session.day_log_id);
        return date ? [{ exercise, date }] : [];
      })
      .sort((left, right) => right.date.localeCompare(left.date));
    const latest = dated[0];
    if (!latest) continue;

    const allSets = dated.flatMap(
      ({ exercise }) => setsByExercise.get(exercise.id) ?? [],
    );
    let bestWeightKg: number | null = null;
    for (const set of allSets) {
      const weight = asNumber(set.actual_weight_kg);
      if (weight !== null && (bestWeightKg === null || weight > bestWeightKg)) {
        bestWeightKg = weight;
      }
    }

    const lastSets: EditableWorkoutSet[] = (
      setsByExercise.get(latest.exercise.id) ?? []
    ).map((set) => ({
      set_number: set.set_number,
      target_reps: set.target_reps,
      target_weight_kg: asNumber(set.target_weight_kg),
      target_rir: set.target_rir,
      actual_reps: set.actual_reps,
      actual_weight_kg: asNumber(set.actual_weight_kg),
      is_completed: set.is_completed,
      notes: set.notes,
    }));

    exerciseProgress.push({
      exerciseId,
      name: latest.exercise.nombre_snapshot,
      muscleGroup:
        latest.exercise.muscle_group_label_snapshot ??
        latest.exercise.grupo_muscular_snapshot,
      sessions: new Set(history.map((item) => item.workout_session_id)).size,
      lastDate: latest.date,
      bestWeightKg,
      totalVolumeKg: allSets.reduce(
        (total, set) => total + workoutSetVolume(set),
        0,
      ),
      lastDecision: latest.exercise.decision,
      lastSets,
    });
  }

  return {
    weeks,
    exercises: exerciseProgress.sort((left, right) =>
      left.name.localeCompare(right.name, "es"),
    ),
  };
}
