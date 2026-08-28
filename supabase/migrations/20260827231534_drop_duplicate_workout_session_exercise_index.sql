-- Conserva idx_workout_session_exercises_exercise_created, que tiene la misma
-- definición y es el índice elegido por las lecturas históricas por ejercicio.
drop index if exists public.idx_workout_session_exercises_exercise;
