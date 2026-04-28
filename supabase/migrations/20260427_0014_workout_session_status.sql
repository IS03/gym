-- Estado explícito de sesión + 1 in_progress por usuario
-- (requiere user_id en workout_sessions para índice parcial único)

do $$ begin
  create type public.workout_session_status as enum ('in_progress', 'completed');
exception
  when duplicate_object then null;
end $$;

alter table public.workout_sessions
  add column if not exists status public.workout_session_status;

-- Backfill por ended_at
update public.workout_sessions
set status = 'completed'
where status is null and ended_at is not null;

update public.workout_sessions
set status = 'in_progress'
where status is null and ended_at is null;

update public.workout_sessions
set status = 'in_progress'
where status is null;

alter table public.workout_sessions
  alter column status set default 'in_progress';

alter table public.workout_sessions
  alter column status set not null;

-- Si había varias "abiertas" por usuario, dejar solo la más reciente en in_progress
with ranked as (
  select
    ws.id,
    row_number() over (
      partition by d.user_id
      order by ws.created_at desc
    ) as rn
  from public.workout_sessions ws
  join public.day_logs d on d.id = ws.day_log_id
  where ws.ended_at is null
    and ws.status = 'in_progress'
)
update public.workout_sessions ws
set
  status = 'completed',
  ended_at = coalesce(ws.ended_at, now())
from ranked r
where ws.id = r.id
  and r.rn > 1;

alter table public.workout_sessions
  add column if not exists user_id uuid;

update public.workout_sessions ws
set user_id = d.user_id
from public.day_logs d
where d.id = ws.day_log_id
  and ws.user_id is null;

-- FK opcional a auth.users (mismo patrón que day_logs)
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'workout_sessions'
      and constraint_name = 'workout_sessions_user_id_fkey'
  ) then
    alter table public.workout_sessions
      add constraint workout_sessions_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

alter table public.workout_sessions
  alter column user_id set not null;

create or replace function public.workout_sessions_sync_user_id()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid;
begin
  select d.user_id into v_user_id
  from public.day_logs d
  where d.id = new.day_log_id;
  if v_user_id is null then
    raise exception 'workout_sessions: day_log_id inválido o sin user_id';
  end if;
  new.user_id := v_user_id;
  return new;
end;
$$;

drop trigger if exists tr_workout_sessions_sync_user_id on public.workout_sessions;
create trigger tr_workout_sessions_sync_user_id
before insert or update of day_log_id on public.workout_sessions
for each row
execute function public.workout_sessions_sync_user_id();

drop index if exists public.uniq_workout_sessions_user_in_progress;
create unique index uniq_workout_sessions_user_in_progress
on public.workout_sessions (user_id)
where status = 'in_progress';

create index if not exists idx_workout_sessions_user_status
on public.workout_sessions (user_id, status);

comment on column public.workout_sessions.status is 'in_progress: entrenamiento activo; completed: finalizada por el usuario.';
comment on column public.workout_sessions.user_id is 'Redundante con day_logs: necesario para unicidad de sesión en curso.';
