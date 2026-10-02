-- M3.3B rollout fix: PostgREST/proxy recovery of SQLSTATE 40001 can obscure an
-- intentional stale-CAS rejection as a timeout/503. At the Mobile RPC boundary,
-- translate ONLY that domain rejection to PT409 (PostgREST's custom HTTP status).
-- Shared Web primitives, CAS tokens, locks, payloads, RLS and grants stay intact.
begin;
do $normalize_conflict$
declare
  v_signature text;
  v_oid regprocedure;
  v_original text;
  v_patched text;
  v_definition text;
  v_handler constant text := E'\nexception\n  when serialization_failure then\n    if sqlerrm = ''SESSION_EXERCISE_CHANGED'' then\n      raise exception using errcode = ''PT409'', message = ''SESSION_EXERCISE_CHANGED'';\n    end if;\n    raise;\nend;\n';
begin
  foreach v_signature in array array[
    'public.mobile_save_workout_exercise(uuid,uuid,timestamptz,jsonb)',
    'public.mobile_mutate_workout_session(uuid,text,text,uuid,timestamptz,uuid,jsonb)'
  ] loop
    v_oid := pg_catalog.to_regprocedure(v_signature);
    if v_oid is null then raise exception 'M3.3B Mobile primitive missing'; end if;
    select prosrc into v_original from pg_catalog.pg_proc where oid = v_oid;
    if position('errcode = ''PT409''' in v_original) = 0 then
      v_patched := pg_catalog.regexp_replace(v_original, '[[:space:]]*end;[[:space:]]*$', v_handler);
      if v_patched = v_original then raise exception 'Expected Mobile RPC block not found'; end if;
      v_definition := pg_catalog.pg_get_functiondef(v_oid);
      execute pg_catalog.replace(v_definition, v_original, v_patched);
    end if;
  end loop;
end;
$normalize_conflict$;
commit;
