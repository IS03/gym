-- Entrenamiento: evitar duplicados de exercises dentro de una rutina.
begin;

-- No permitir agregar el mismo exercise dos veces a la misma rutina.
create unique index if not exists uniq_routine_exercises_routine_exercise
on public.routine_exercises(routine_id, exercise_id);

commit;

