-- El objetivo de RIR vive en target_rir; las notas sólo conservan observaciones.
begin;

update public.routine_exercise_sets
set notes = nullif(
  btrim(
    regexp_replace(
      notes,
      E'(^|[[:space:]]*·[[:space:]]*)RIR:?[[:space:]]*[0-9]+(?:[–-][0-9]+)?([[:space:]]*·[[:space:]]*|$)',
      E'\\1',
      'gi'
    ),
    ' ·'
  ),
  ''
)
where notes ~* 'RIR:?[[:space:]]*[0-9]';

commit;
