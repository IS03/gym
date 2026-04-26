export type ExerciseType = "strength" | "abs" | "cardio" | "mobility" | "other";

export type Exercise = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  exercise_type: ExerciseType;
  default_sets: number | null;
  default_reps: number | null;
  default_rest_seconds: number | null;
  default_weight_kg: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineType = "strength" | "abs" | "cardio" | "mixed";

export type Routine = {
  id: string;
  user_id: string;
  name: string;
  routine_type: RoutineType;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string;
  exercise_order: number;
  default_sets: number | null;
  default_reps: number | null;
  default_rest_seconds: number | null;
  default_weight_kg: number | null;
  default_duration_seconds: number | null;
  default_distance_meters: number | null;
  default_speed_kmh: number | null;
  default_incline_percent: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  day_log_id: string;
  base_routine_id: string | null;
  title: string | null;
  session_order: number;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSessionExerciseSourceType = "routine" | "extra" | "manual_new";

export type WorkoutSessionExercise = {
  id: string;
  user_id: string;
  workout_session_id: string;
  routine_exercise_id: string | null;
  exercise_id: string;
  exercise_name_snapshot: string;
  category_snapshot: string | null;
  exercise_type_snapshot: ExerciseType;
  source_type: WorkoutSessionExerciseSourceType;
  exercise_order: number;
  notes: string | null;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  user_id: string;
  workout_session_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rest_seconds: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  speed_kmh: number | null;
  incline_percent: number | null;
  rpe: number | null;
  notes: string | null;
  created_at: string;
};

