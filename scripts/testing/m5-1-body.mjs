// Disposable PostgreSQL 17: actual Body/Nutrition schema, weight trigger, energy
// derivation, Physical Profile writer, ledger and the M5.1 Body RPCs.
// No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m5-1-body.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m51-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory, 'db'), port, user: 'postgres', password: 'local-test',
  persistent: true, createPostgresUser: false, onLog: () => {}, onError: () => {}, postgresFlags: ['-h', '127.0.0.1'] });
const clients = []; let started = false; let checks = 0;
async function connect() { const c = pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const id = n => `51000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), other = id(2);
async function role(c, user = owner) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); }
async function check(name, run) { await run(); console.log(`PASS ${name}`); checks++; }
try {
  await pg.initialise(); await pg.start(); started = true;
  const admin = await connect(), a = await connect(), b = await connect(), stranger = await connect();
  await admin.query(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const name of ['0001.sql', '20260426_0002_phase1_profiles_weight_and_checks.sql', '20260426_0004_phase1_remove_meal_status.sql', '20260813150000_nutrition_schema_foundation.sql']) await admin.query(await file(name));
  await admin.query('create table public.workout_sessions(id uuid primary key,user_id uuid,day_log_id uuid,status text)');
  for (const name of ['20260813000000_body_measurements.sql', '20260813133845_atomic_weight_and_current_day_snapshots.sql', '20260813134351_centralize_profile_energy_derivation.sql', '20260813163000_nutrition_day_engine.sql', '20260813170000_nutrition_energy_sync.sql', '20260908170000_nutrition_plan_energy_v2.sql', '20260908220654_pr71_1_plan_energy_coherence.sql', '20260909180000_daily_nutrition_overrides_v2.sql']) await admin.query(await file(name));
  const normalization = await file('20260426_0012_normalize_names_uppercase.sql');
  await admin.query(normalization.slice(normalization.indexOf('create or replace function'), normalization.indexOf('$$;', normalization.indexOf('create or replace function')) + 3));
  await admin.query(await file('20260426_0013_normalize_meals_uppercase.sql'));
  const ledger = await file('20260927190000_mobile_training_api_expand.sql');
  await admin.query(ledger.slice(0, ledger.indexOf('create function public.mobile_create_training_routine')) + 'commit;');
  for (const name of ['20260909155017_configurable_daily_metrics.sql', '20260914104157_r3_atomic_daily_metric_values.sql', '20261003021157_mobile_nutrition_day_read.sql', '20261003040926_mobile_activity_context_writes.sql']) await admin.query(await file(name));
  await admin.query('insert into auth.users values($1),($2)', [owner, other]);
  await admin.query('grant select,insert,update,delete on public.day_logs,public.meal_entries to authenticated; grant select,insert,update on public.profiles,public.nutrition_goal_periods,public.expenditure_rule_periods to authenticated');
  await role(a); await role(b); await role(stranger, other);
  await admin.query(await file('20260814010000_nutrition_import_blockers.sql'));
  for (const name of ['20260830171201_saved_meals.sql', '20260908223000_food_calories_decimal.sql', '20261004010134_mobile_quick_registration.sql']) await admin.query(await file(name));
  await admin.query('grant usage on schema extensions to authenticated; grant select on public.profiles, public.workout_sessions to authenticated');
  await admin.query(await file('20261004175844_mobile_nutrition_configuration.sql'));
  await admin.query(await file('20261004230000_mobile_body_expand.sql'));
  const day = async (offset) => (await admin.query('select ((statement_timestamp() at time zone \'America/Argentina/Cordoba\')::date+$1::int)::text d', [offset])).rows[0].d;
  const today = await day(0), yesterday = await day(-1), older = await day(-10), tomorrow = await day(1);
  const read = async (c = a, wl = 30, ml = 20, wb = null, mb = null) => (await c.query('select public.mobile_read_body($1,$2,$3,$4) d', [wb, wl, mb, ml])).rows[0].d;
  const weight = async (i, c = a) => (await c.query('select * from public.mobile_mutate_body_weight($1)', [JSON.stringify(i)])).rows[0];
  const measure = async (i, c = a) => (await c.query('select * from public.mobile_mutate_body_measurement($1)', [JSON.stringify(i)])).rows[0];
  const profile = async (user = owner) => (await admin.query('select current_weight_kg,bmr_kcal_current from profiles where user_id=$1', [user])).rows[0];
  const w = (operation, date, expectedWeightKg, weightKg, idempotencyKey) => ({ operation, date, expectedWeightKg, weightKg, idempotencyKey });
  const empty = { measuredOn: today, waistCm: null, abdomenCm: null, chestCm: null, hipCm: null, armRightCm: null, armLeftCm: null, thighRightCm: null, thighLeftCm: null, calfRightCm: null, calfLeftCm: null, condition: null, notes: null };
  const mi = (operation, measurementId, expectedUpdatedAt, fields, idempotencyKey) => ({ operation, measurementId, expectedUpdatedAt, fields, idempotencyKey });

  await check('empty Body read is explicit absence, never zero, and materializes nothing', async () => {
    const r = await read(); assert.equal(r.today, today); assert.equal(r.current, null); assert.equal(r.profileWeightKg, null);
    assert.deepEqual(r.weights, []); assert.deepEqual(r.measurements, []);
    assert.equal((await admin.query('select count(*)::int n from day_logs')).rows[0].n, 0);
  });
  await check('set today syncs profile current weight and canonical BMR through the existing trigger', async () => {
    await admin.query("insert into profiles(user_id,birth_date,sex,height_cm) values($1,'1990-01-01','male',180)", [owner]);
    const r = await weight(w('set', today, null, 80.25, 'w1')); assert.equal(r.response_status, 200);
    assert.deepEqual(r.response_body.current, { date: today, weightKg: 80.25 }); assert.equal(r.response_body.currentWeightChanged, true);
    const p = await profile(); assert.equal(Number(p.current_weight_kg), 80.25); assert.ok(p.bmr_kcal_current > 0);
    const replay = await weight(w('set', today, null, 80.25, 'w1')); assert.equal(replay.replayed, true); assert.deepEqual(replay.response_body, r.response_body);
    assert.equal((await weight(w('set', today, null, 81, 'w1'))).response_body.error, 'IDEMPOTENCY_KEY_REUSED');
  });
  await check('decimal scale is normalized for replay and stale CAS never overwrites', async () => {
    const r = await weight(w('set', today, 80.25, 80.5, 'w2')); assert.equal(r.response_status, 200);
    assert.equal((await weight(w('set', today, 80.25, 80.50, 'w2'))).replayed, true);
    const stale = await weight(w('set', today, 80.25, 99, 'w3')); assert.equal(stale.response_body.error, 'WEIGHT_CHANGED');
    assert.equal(Number((await profile()).current_weight_kg), 80.5);
    assert.equal((await weight(w('set', today, null, 99, 'w4'))).response_body.error, 'WEIGHT_CHANGED');
  });
  await check('historical set/edit never replaces the current weight', async () => {
    const before = await profile();
    const r = await weight(w('set', yesterday, null, 82, 'h1')); assert.equal(r.response_status, 200); assert.equal(r.response_body.currentWeightChanged, false);
    assert.deepEqual(r.response_body.current, { date: today, weightKg: 80.5 });
    assert.equal((await weight(w('set', yesterday, 82, 81.75, 'h2'))).response_status, 200);
    assert.deepEqual(await profile(), before);
    assert.equal((await weight(w('set', older, null, 83, 'h3'))).response_status, 200);
  });
  await check('deleting the latest weight clears it (not 0) and resyncs current weight/BMR', async () => {
    const bmrBefore = (await profile()).bmr_kcal_current;
    const r = await weight(w('delete', today, 80.5, null, 'd1')); assert.equal(r.response_status, 200); assert.equal(r.response_body.currentWeightChanged, true);
    assert.deepEqual(r.response_body.current, { date: yesterday, weightKg: 81.75 });
    const p = await profile(); assert.equal(Number(p.current_weight_kg), 81.75); assert.notEqual(p.bmr_kcal_current, bmrBefore);
    const row = (await admin.query('select weight_kg from day_logs where user_id=$1 and log_date=$2', [owner, today])).rows[0];
    assert.equal(row.weight_kg, null);
    assert.equal((await weight(w('delete', today, 80.5, null, 'd2'))).response_body.error, 'WEIGHT_CHANGED');
    assert.equal((await weight(w('delete', today, null, null, 'd3'))).response_status, 200);
  });
  await check('future dates are rejected by the server; invalid weights never reach the table', async () => {
    assert.equal((await weight(w('set', tomorrow, null, 80, 'f1'))).response_body.error, 'BODY_FUTURE_DATE');
    for (const bad of [w('set', today, null, -1, 'x1'), w('set', today, null, 1000, 'x2'), w('set', today, null, 80.123, 'x3'),
      w('set', today, null, null, 'x4'), w('delete', today, null, 80, 'x5'), { ...w('set', today, null, 80, 'x6'), extra: 1 }, w('set', '2026-02-30', null, 80, 'x7')]) {
      await assert.rejects(weight(bad));
    }
    assert.equal((await admin.query("select count(*)::int n from day_logs where user_id=$1 and log_date=$2::date", [owner, tomorrow])).rows[0].n, 0);
  });
  await check('Body weight writes change the Physical Profile CAS version (one coherent weight domain)', async () => {
    const before = (await a.query("select public.mobile_configuration_state('physical') d")).rows[0].d.version;
    await weight(w('set', today, null, 79, 'p1'));
    const after = (await a.query("select public.mobile_configuration_state('physical') d")).rows[0].d.version;
    assert.notEqual(before, after);
  });
  await check('ownership: reads and writes are scoped to auth.uid()', async () => {
    const r = await read(stranger); assert.equal(r.current, null); assert.deepEqual(r.weights, []);
    assert.equal((await weight(w('delete', today, 79, null, 'own1'), stranger)).response_body.error, 'WEIGHT_CHANGED');
    assert.equal(Number((await profile()).current_weight_kg), 79);
  });
  await check('newest-first keyset pages with limit+1', async () => {
    const r = await read(a, 2, 0); assert.deepEqual(r.weights.map(x => x.date), [today, yesterday, older]); assert.deepEqual(r.measurements, []);
    const next = await read(a, 2, 0, yesterday); assert.deepEqual(next.weights.map(x => x.date), [older]);
  });

  let created;
  await check('measurement create returns an allowlisted DTO, replays exactly and rejects a taken date', async () => {
    const r = await measure(mi('create', null, null, { ...empty, waistCm: 80.5, notes: '  ', condition: ' Ayunas ' }, 'm1'));
    assert.equal(r.response_status, 200); created = r.response_body.measurement;
    assert.equal(created.waistCm, 80.5); assert.equal(created.notes, null); assert.equal(created.condition, 'Ayunas'); assert.equal(created.imported, false);
    assert.equal(created.qualityStatus, 'verified'); assert.equal('source_payload' in created, false); assert.equal('user_id' in created, false);
    assert.equal((await measure(mi('create', null, null, { ...empty, waistCm: 80.50, notes: '', condition: 'Ayunas' }, 'm1'))).replayed, true);
    assert.equal((await measure(mi('create', null, null, { ...empty, waistCm: 81 }, 'm2'))).response_body.error, 'MEASUREMENT_DATE_TAKEN');
    assert.equal((await measure(mi('create', null, null, { ...empty, waistCm: 82 }, 'm1'))).response_body.error, 'IDEMPOTENCY_KEY_REUSED');
  });
  await check('measurement CAS, explicit date collision and future-date rejection', async () => {
    assert.equal((await measure(mi('update', created.id, '2020-01-01T00:00:00Z', { ...empty, waistCm: 70 }, 'u1'))).response_body.error, 'MEASUREMENT_CHANGED');
    const ok = await measure(mi('update', created.id, created.updatedAt, { ...empty, measuredOn: yesterday, waistCm: 79 }, 'u2'));
    assert.equal(ok.response_status, 200); assert.equal(ok.response_body.measurement.measuredOn, yesterday); assert.notEqual(ok.response_body.measurement.updatedAt, created.updatedAt);
    created = ok.response_body.measurement;
    const second = (await measure(mi('create', null, null, { ...empty, chestCm: 100 }, 'm3'))).response_body.measurement;
    const collide = await measure(mi('update', second.id, second.updatedAt, { ...empty, measuredOn: yesterday, chestCm: 100 }, 'u3'));
    assert.equal(collide.response_body.error, 'MEASUREMENT_DATE_TAKEN');
    assert.equal((await admin.query('select measured_on::text d from body_measurements where id=$1', [second.id])).rows[0].d, today);
    assert.equal((await measure(mi('update', second.id, second.updatedAt, { ...empty, measuredOn: tomorrow, chestCm: 100 }, 'u4'))).response_body.error, 'BODY_FUTURE_DATE');
    assert.equal((await measure(mi('create', null, null, { ...empty, measuredOn: tomorrow, chestCm: 100 }, 'u5'))).response_body.error, 'BODY_FUTURE_DATE');
    await assert.rejects(measure(mi('create', null, null, { ...empty, measuredOn: older }, 'u6')));
    await assert.rejects(measure(mi('create', null, null, { ...empty, measuredOn: older, waistCm: 0 }, 'u7')));
    await assert.rejects(measure(mi('create', null, null, { ...empty, measuredOn: older, waistCm: 501 }, 'u8')));
  });
  await check('correcting an imported suspect row verifies it and preserves provenance and legacy fields', async () => {
    const run = id(90);
    await admin.query("insert into nutrition_import_runs(id,user_id,source_name,source_sha256) values($1,$2,'sheet',repeat('a',64))", [run, owner]);
    const row = (await admin.query(`insert into body_measurements(user_id,measured_on,arm_cm,waist_cm,legacy_import_source,legacy_import_id,import_run_id,quality_status,quality_note,source_payload)
      values($1,$2,33,20,'sheet','r7',$3,'suspect','Revisar importación','{"raw":1}') returning id`, [owner, older, run])).rows[0];
    const read1 = (await read()).measurements.find(m => m.id === row.id);
    assert.equal(read1.imported, true); assert.equal(read1.importSource, 'sheet'); assert.equal(read1.qualityStatus, 'suspect'); assert.equal(read1.armCm, 33);
    const r = await measure(mi('update', row.id, read1.updatedAt, { ...empty, measuredOn: older, waistCm: 82 }, 'q1'));
    assert.equal(r.response_status, 200); assert.equal(r.response_body.measurement.qualityStatus, 'verified'); assert.equal(r.response_body.measurement.qualityNote, null);
    const stored = (await admin.query('select * from body_measurements where id=$1', [row.id])).rows[0];
    assert.equal(Number(stored.arm_cm), 33); assert.equal(stored.legacy_import_source, 'sheet'); assert.equal(stored.import_run_id, run); assert.deepEqual(stored.source_payload, { raw: 1 });
    const del = await measure(mi('delete', row.id, r.response_body.measurement.updatedAt, null, 'q2'));
    assert.equal(del.response_status, 200); assert.equal(del.response_body.measurement, null);
    assert.equal((await measure(mi('delete', row.id, r.response_body.measurement.updatedAt, null, 'q2'))).replayed, true);
    assert.equal((await measure(mi('delete', row.id, r.response_body.measurement.updatedAt, null, 'q3'))).response_status, 404);
  });
  await check('measurement ownership and concurrent create race', async () => {
    assert.equal((await measure(mi('update', created.id, created.updatedAt, { ...empty, waistCm: 1 }, 'o1'), stranger)).response_status, 404);
    assert.equal((await measure(mi('delete', created.id, created.updatedAt, null, 'o2'), stranger)).response_status, 404);
    assert.equal((await read(stranger)).measurements.length, 0);
    const fields = { ...empty, measuredOn: older, hipCm: 95 };
    const race = await Promise.all([measure(mi('create', null, null, fields, 'race-a'), a), measure(mi('create', null, null, { ...fields, hipCm: 96 }, 'race-b'), b)]);
    assert.deepEqual(race.map(x => x.response_status).sort(), [200, 409]);
  });
  await check('a failing write rolls back the domain change and its ledger row together', async () => {
    await admin.query("create function public.fail_body_test() returns trigger language plpgsql as $$begin raise exception 'test body failure'; end$$; create trigger fail_body_test before update of weight_kg on public.day_logs for each row execute function public.fail_body_test();");
    const before = await profile();
    await assert.rejects(weight(w('set', today, 79, 70, 'fail1')));
    assert.deepEqual(await profile(), before);
    assert.equal((await admin.query("select count(*)::int n from mobile_idempotency_keys where idempotency_key='fail1'")).rows[0].n, 0);
    await admin.query('drop trigger fail_body_test on public.day_logs; drop function public.fail_body_test();');
  });
  console.log(`M5.1 body harness: ${checks} checks passed`);
} finally {
  for (const c of clients) await c.end().catch(() => undefined);
  if (started) await pg.stop().catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
}
