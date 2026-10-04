// Disposable PostgreSQL 17: actual daily metrics schema, Web RPCs, legacy
// projection trigger, M4.1-3 Mobile wrapper and the M5.2 integrity migration.
// No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m5-2-daily-metrics.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m52-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory, 'db'), port, user: 'postgres', password: 'local-test',
  persistent: true, createPostgresUser: false, onLog: () => {}, onError: () => {}, postgresFlags: ['-h', '127.0.0.1'] });
const clients = []; let started = false; let checks = 0;
async function connect() { const c = pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const id = n => `52000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
  for (const name of ['20260813163000_nutrition_day_engine.sql', '20260813170000_nutrition_energy_sync.sql', '20260908170000_nutrition_plan_energy_v2.sql', '20260909180000_daily_nutrition_overrides_v2.sql']) await admin.query(await file(name));
  const normalization = await file('20260426_0012_normalize_names_uppercase.sql');
  await admin.query(normalization.slice(normalization.indexOf('create or replace function'), normalization.indexOf('$$;', normalization.indexOf('create or replace function')) + 3));
  await admin.query(await file('20260426_0013_normalize_meals_uppercase.sql'));
  const ledger = await file('20260927190000_mobile_training_api_expand.sql');
  await admin.query(ledger.slice(0, ledger.indexOf('create function public.mobile_create_training_routine')) + 'commit;');
  for (const name of ['20260909155017_configurable_daily_metrics.sql', '20260914104157_r3_atomic_daily_metric_values.sql', '20261003021157_mobile_nutrition_day_read.sql', '20261003040926_mobile_activity_context_writes.sql', '20261004235000_mobile_daily_metrics_integrity.sql']) await admin.query(await file(name));
  await admin.query('insert into auth.users values($1),($2)', [owner, other]);
  await admin.query('grant select,insert,update on public.day_logs,public.meal_entries to authenticated; grant select on public.profiles, public.workout_sessions to authenticated');
  await role(a); await role(b); await role(stranger, other);
  await a.query('select public.ensure_user_metrics()'); await stranger.query('select public.ensure_user_metrics()');
  await admin.query("insert into public.user_metrics(user_id,name,unit,value_type) values($1,'Personal','u','decimal')", [owner]);
  const day = async offset => (await admin.query("select ((statement_timestamp() at time zone 'America/Argentina/Cordoba')::date+$1::int)::text d", [offset])).rows[0].d;
  const today = await day(0), yesterday = await day(-1), old = await day(-30), tomorrow = await day(1);
  const definitions = async () => (await admin.query('select *,updated_at::text version from public.user_metrics where user_id=$1', [owner])).rows;
  let defs = await definitions();
  const m = key => defs.find(x => x.system_key === key || x.name === key);
  const version = async (metricId, dt) => (await admin.query('select updated_at::text v from public.daily_metric_values where user_id=$1 and metric_id=$2 and metric_date=$3', [owner, metricId, dt])).rows[0]?.v ?? null;
  const change = async (key, value, dt) => ({ metricId: m(key).id, definitionUpdatedAt: m(key).version, expectedUpdatedAt: await version(m(key).id, dt), value });
  const metrics = (key, changes, dt) => ({ operation: 'metrics', date: dt, idempotencyKey: key, changes });
  const mutate = async (c, intent) => (await c.query('select * from public.mobile_mutate_nutrition_day($1::jsonb)', [JSON.stringify(intent)])).rows[0];
  const val = async (key, dt) => (await admin.query('select value from public.daily_metric_values where user_id=$1 and metric_id=$2 and metric_date=$3', [owner, m(key).id, dt])).rows[0]?.value ?? null;
  const dayLog = async dt => (await admin.query('select * from public.day_logs where user_id=$1 and log_date=$2', [owner, dt])).rows[0] ?? null;

  await check('Mobile rejects future metric values with a stable, replayable receipt; today and past accepted', async () => {
    const future = metrics('future-1', [await change('steps', 1000, tomorrow)], tomorrow);
    const r = await mutate(a, future);
    assert.equal(r.response_status, 409); assert.equal(r.response_body.error, 'METRIC_FUTURE_DATE');
    assert.equal(r.response_body.message, 'No se pueden registrar métricas en una fecha futura.');
    assert.equal((await mutate(a, future)).replayed, true);
    assert.equal(await val('steps', tomorrow), null);
    assert.equal((await mutate(a, metrics('today-1', [await change('steps', 0, today)], today))).response_status, 200);
    assert.equal((await mutate(a, metrics('past-1', [await change('water', 1.25, yesterday)], yesterday))).response_status, 200);
    assert.equal(Number(await val('steps', today)), 0);
  });
  await check('Web paths reject future dates too (RPC, legacy activity RPC, direct write); unset is never blocked', async () => {
    await assert.rejects(b.query('select public.save_daily_metric_values($1,$2::jsonb,false)', [tomorrow, JSON.stringify({ [m('steps').id]: 10 })]), /metric_future_date/);
    await assert.rejects(b.query('insert into public.daily_metric_values(user_id,metric_id,metric_date,value) values($1,$2,$3,5)', [owner, m('water').id, tomorrow]), /metric_future_date/);
    await admin.query('insert into public.day_logs(user_id,log_date) values($1,$2)', [owner, tomorrow]);
    const futureDay = await dayLog(tomorrow);
    await assert.rejects(b.query('select public.save_daily_activity_metrics($1,10,null,null)', [futureDay.id]), /metric_future_date/);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,false)', [today, JSON.stringify({ [m('mate').id]: 0.5 })]);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,false)', [today, JSON.stringify({ [m('mate').id]: null })]);
    assert.equal(await val('mate', today), null);
    await admin.query('delete from public.day_logs where id=$1', [futureDay.id]);
  });
  await check('value first, day_log later: projections are completed; metrics never create day_logs', async () => {
    const dt = old;
    const r = await mutate(a, metrics('proj-1', [await change('steps', 0, dt), await change('water', 2.5, dt), await change('Personal', 3.75, dt)], dt));
    assert.equal(r.response_status, 200); assert.equal(await dayLog(dt), null);
    const created = (await a.query('select * from public.get_or_create_day_log($1)', [dt])).rows[0];
    assert.equal(created.steps, 0); assert.equal(Number(created.water_l), 2.5); assert.equal(created.mate_l, null);
    assert.equal((await mutate(a, metrics('proj-2', [await change('steps', 8000, dt), await change('water', null, dt), await change('mate', 1, dt)], dt))).response_status, 200);
    const after = await dayLog(dt); assert.equal(after.steps, 8000); assert.equal(after.water_l, null); assert.equal(Number(after.mate_l), 1);
  });
  await check('a direct day_log insert keeps its own projection when no canonical value exists', async () => {
    const dt = await day(-40);
    await admin.query('insert into public.day_logs(user_id,log_date,steps) values($1,$2,123)', [owner, dt]);
    assert.equal((await dayLog(dt)).steps, 123);
    const dt2 = await day(-41);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,false)', [dt2, JSON.stringify({ [m('steps').id]: 500 })]);
    await admin.query('insert into public.day_logs(user_id,log_date,steps) values($1,$2,999)', [owner, dt2]);
    assert.equal((await dayLog(dt2)).steps, 500); // canonical wins over a stale inserted projection
  });
  await check('existing semantics: decimal/duration/zero/unset, batch atomicity, value + definition CAS, replay', async () => {
    const dt = await day(-5);
    await admin.query("insert into public.user_metrics(user_id,name,unit,value_type) values($1,'Dur','min','duration')", [owner]); defs = await definitions();
    const batch = metrics('sem-1', [await change('Personal', 0.0001, dt), await change('Dur', 0, dt), await change('steps', 0, dt)], dt);
    assert.equal((await mutate(a, batch)).response_status, 200); assert.equal((await mutate(a, batch)).replayed, true);
    assert.equal((await mutate(a, { ...batch, changes: [await change('steps', 1, dt)] })).response_body.error, 'IDEMPOTENCY_KEY_REUSED');
    const stale = metrics('sem-2', [await change('Personal', 1, dt), await change('steps', 2, dt)], dt);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,false)', [dt, JSON.stringify({ [m('steps').id]: 7 })]);
    assert.equal((await mutate(a, stale)).response_body.error, 'METRICS_CHANGED');
    assert.equal(Number(await val('Personal', dt)), 0.0001);
    await assert.rejects(mutate(a, metrics('sem-3', [await change('Personal', 2, dt), await change('Dur', 1.5, dt)], dt)));
    assert.equal(Number(await val('Personal', dt)), 0.0001);
    const staleDef = metrics('sem-4', [{ ...(await change('Personal', 3, dt)), definitionUpdatedAt: '2020-01-01T00:00:00Z' }], dt);
    assert.equal((await mutate(a, staleDef)).response_body.error, 'METRICS_CHANGED');
    assert.equal((await mutate(a, metrics('sem-5', [await change('Dur', null, dt)], dt))).response_status, 200);
    assert.equal(await val('Dur', dt), null);
  });
  await check('archived rules unchanged: historical correction/unset only with an existing value; never today or future', async () => {
    const dt = await day(-6);
    assert.equal((await mutate(a, metrics('arch-1', [await change('Personal', 5, dt)], dt))).response_status, 200);
    await admin.query("update public.user_metrics set is_active=false, archived_at=now() where id=$1", [m('Personal').id]); defs = await definitions();
    assert.equal((await mutate(a, metrics('arch-2', [await change('Personal', 6, dt)], dt))).response_status, 200);
    assert.equal((await mutate(a, metrics('arch-3', [await change('Personal', 1, await day(-7))], await day(-7)))).response_body.error, 'METRIC_UNAVAILABLE');
    assert.equal((await mutate(a, metrics('arch-4', [await change('Personal', 1, today)], today))).response_body.error, 'METRIC_UNAVAILABLE');
    assert.equal((await mutate(a, metrics('arch-5', [await change('Personal', null, dt)], dt))).response_status, 200);
  });
  await check('context writes are unaffected and ownership stays scoped', async () => {
    await a.query('select public.get_or_create_day_log($1)', [yesterday]);
    const expected = (await admin.query('select updated_at::text v from public.day_logs where user_id=$1 and log_date=$2', [owner, yesterday])).rows[0].v;
    const r = await mutate(a, { operation: 'context', date: yesterday, idempotencyKey: 'ctx-1', expectedUpdatedAt: expected, changes: { target: { action: 'set', value: 2100 } } });
    assert.equal(r.response_status, 200);
    assert.equal((await mutate(stranger, metrics('own-1', [await change('steps', 1, yesterday)], yesterday))).response_body.error, 'METRIC_UNAVAILABLE');
  });
  console.log(`M5.2 daily metrics harness: ${checks} checks passed`);
} finally {
  for (const c of clients) await c.end().catch(() => undefined);
  if (started) await pg.stop().catch(() => undefined);
  await rm(directory, { recursive: true, force: true });
}
