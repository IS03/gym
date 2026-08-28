-- PR 11.2: completa únicamente defaults generales de descanso inequívocos.
-- Los descansos de routine_exercises permanecen como configuración por rutina.
begin;

with unanimous_routine_rests as (
  select
    re.exercise_id,
    min(re.rest_min_seconds) as rest_min_seconds,
    min(re.rest_max_seconds) as rest_max_seconds
  from public.routine_exercises re
  where re.rest_min_seconds is not null
     or re.rest_max_seconds is not null
  group by re.exercise_id
  having count(distinct (re.rest_min_seconds, re.rest_max_seconds)) = 1
     and bool_and(
       re.rest_min_seconds is not null
       and re.rest_max_seconds is not null
     )
)
update public.exercises e
set
  descanso_min_sugerido_segundos = rests.rest_min_seconds,
  descanso_max_sugerido_segundos = rests.rest_max_seconds
from unanimous_routine_rests rests
where e.id = rests.exercise_id
  and e.descanso_min_sugerido_segundos is null
  and e.descanso_max_sugerido_segundos is null;

commit;
