// Shared disposable fixture; loads real Training functions, never remote data.
import { readFile } from 'node:fs/promises';
export const readTrainingTestFile = file => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
export function trainingSqlFunction(source, name) {
  const sql = source.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0];
  if (!sql) throw new Error(`Missing production function ${name}`);
  return sql;
}
export async function bootstrapTrainingPostgres(client) {
  await client.query(await readTrainingTestFile('supabase/tests/m3_3b_bootstrap.sql'));
  const base = await readTrainingTestFile('supabase/migrations/20260810112232_training_robust_rebuild.sql');
  const resilience = await readTrainingTestFile('supabase/migrations/20260826114439_workout_sync_resilience.sql');
  const editor = await readTrainingTestFile('supabase/migrations/20260928140340_mobile_routine_editor_start_expand.sql');
  const ledger = await readTrainingTestFile('supabase/migrations/20260927190000_mobile_training_api_expand.sql');
  const repair = await readTrainingTestFile('supabase/migrations/20260426_0008_training_repair_converge.sql');
  const initial = await readTrainingTestFile('supabase/migrations/0001.sql');
  for (const [source, names] of [
    [initial, ['set_updated_at']],
    [base, ['workout_session_exercises_init_robust', 'workout_sets_sync_owner_and_completion']],
    [resilience, ['workout_session_exercises_sync_legacy_sets']],
    [editor, ['lock_training_user_mutations', 'lock_training_user_before_write', 'workout_session_exercises_create_default_sets', 'start_workout_session', 'finish_workout_session']],
    [repair, ['trg_workout_session_exercises_completion']],
  ]) for (const name of names) await client.query(trainingSqlFunction(source, name));
  await client.query("create function public.normalize_name(value text) returns text language sql immutable as $$ select nullif(upper(regexp_replace(btrim(value),'\\s+',' ','g')),'') $$");
  await client.query(ledger.slice(0, ledger.indexOf('create function public.mobile_create_training_routine')) + 'commit;');
  await client.query(trainingSqlFunction(ledger, 'mobile_create_training_exercise'));
  await client.query(`
    create trigger training_lock before insert or update or delete on public.exercises for each statement execute function public.lock_training_user_before_write();
    create trigger tr_workout_session_exercises_updated_at before update on public.workout_session_exercises for each row execute function public.set_updated_at();
    create trigger tr_workout_sessions_updated_at before update on public.workout_sessions for each row execute function public.set_updated_at();
    create trigger init before insert on public.workout_session_exercises for each row execute function public.workout_session_exercises_init_robust();
    create trigger defaults after insert on public.workout_session_exercises for each row execute function public.workout_session_exercises_create_default_sets();
    create trigger legacy after update of series_reales,reps_reales,peso_real,is_completed on public.workout_session_exercises for each row execute function public.workout_session_exercises_sync_legacy_sets();
    create trigger completion before update of is_completed,completed_at on public.workout_session_exercises for each row execute function public.trg_workout_session_exercises_completion();
    create trigger set_owner before insert or update of workout_session_exercise_id,user_id,is_completed on public.workout_sets for each row execute function public.workout_sets_sync_owner_and_completion();
  `);
  await client.query(await readTrainingTestFile('supabase/migrations/20260929220000_mobile_active_session_expand.sql'));
  await client.query(await readTrainingTestFile('supabase/migrations/20260930030000_mobile_active_session_conflict_status.sql'));
}
