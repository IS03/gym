-- Ejecutar en una transacción/branch segura. Simula el mismo backfill de la migración.
begin;

create temp table exercise_fixture (
  id text primary key,
  rest_min_seconds integer,
  rest_max_seconds integer
) on commit drop;

create temp table routine_rest_fixture (
  exercise_id text not null references exercise_fixture(id),
  rest_min_seconds integer,
  rest_max_seconds integer
) on commit drop;

insert into exercise_fixture (id, rest_min_seconds, rest_max_seconds) values
  ('one', null, null),
  ('same-two-routines', null, null),
  ('ambiguous', null, null),
  ('already-defaulted', 150, 180),
  ('partial-routine-rest', null, null);

insert into routine_rest_fixture (exercise_id, rest_min_seconds, rest_max_seconds) values
  ('one', 90, 90),
  ('same-two-routines', 90, 90),
  ('same-two-routines', 90, 90),
  ('ambiguous', 90, 90),
  ('ambiguous', 120, 120),
  ('already-defaulted', 90, 90),
  ('partial-routine-rest', null, 90);

with unanimous_routine_rests as (
  select
    re.exercise_id,
    min(re.rest_min_seconds) as rest_min_seconds,
    min(re.rest_max_seconds) as rest_max_seconds
  from routine_rest_fixture re
  where re.rest_min_seconds is not null
     or re.rest_max_seconds is not null
  group by re.exercise_id
  having count(distinct (re.rest_min_seconds, re.rest_max_seconds)) = 1
     and bool_and(
       re.rest_min_seconds is not null
       and re.rest_max_seconds is not null
     )
)
update exercise_fixture e
set
  rest_min_seconds = rests.rest_min_seconds,
  rest_max_seconds = rests.rest_max_seconds
from unanimous_routine_rests rests
where e.id = rests.exercise_id
  and e.rest_min_seconds is null
  and e.rest_max_seconds is null;

do $$
begin
  if (select rest_min_seconds from exercise_fixture where id = 'one') <> 90
     or (select rest_max_seconds from exercise_fixture where id = 'one') <> 90 then
    raise exception 'one routine rest should backfill 90/90';
  end if;

  if (select rest_min_seconds from exercise_fixture where id = 'same-two-routines') <> 90
     or (select rest_max_seconds from exercise_fixture where id = 'same-two-routines') <> 90 then
    raise exception 'matching routine rests should backfill 90/90';
  end if;

  if (select rest_min_seconds from exercise_fixture where id = 'ambiguous') is not null
     or (select rest_max_seconds from exercise_fixture where id = 'ambiguous') is not null then
    raise exception 'ambiguous routine rests must remain null';
  end if;

  if (select rest_min_seconds from exercise_fixture where id = 'already-defaulted') <> 150
     or (select rest_max_seconds from exercise_fixture where id = 'already-defaulted') <> 180 then
    raise exception 'existing exercise defaults must not be overwritten';
  end if;

  if (select rest_min_seconds from exercise_fixture where id = 'partial-routine-rest') is not null
     or (select rest_max_seconds from exercise_fixture where id = 'partial-routine-rest') is not null then
    raise exception 'partial routine rest must not be inferred';
  end if;
end;
$$;

rollback;
