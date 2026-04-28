export type MuscleGroup =
  | "pecho"
  | "espalda"
  | "piernas"
  | "hombros"
  | "bíceps"
  | "tríceps"
  | "abdomen"
  | "cardio";

export type Exercise = {
  id: string;
  user_id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  series_sugeridas: number | null;
  reps_sugeridas: number | null;
  peso_sugerido: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Routine = {
  id: string;
  user_id: string;
  nombre: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string;
  created_at: string;
};

export type WorkoutSessionStatus = "in_progress" | "completed";

export type WorkoutSession = {
  id: string;
  user_id: string;
  day_log_id: string;
  routine_id: string | null;
  status: WorkoutSessionStatus;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSessionExercise = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  nombre_snapshot: string;
  grupo_muscular_snapshot: MuscleGroup | null;
  series_reales: number | null;
  reps_reales: number | null;
  peso_real: number | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

