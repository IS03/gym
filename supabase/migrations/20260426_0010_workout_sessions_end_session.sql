-- Entrenamiento: permitir "terminar sesión" explícitamente.
begin;

alter table public.workout_sessions
  add column if not exists ended_at timestamptz;

create index if not exists idx_workout_sessions_ended_at
on public.workout_sessions(day_log_id, ended_at desc)
where ended_at is not null;

commit;

