// Disposable PostgreSQL 17. Uses production schema/RLS and the actual migration.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-1-1-nutrition-day.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m411-'));
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory, 'db'), port, user: 'postgres', password: 'local-test', persistent: true,
  createPostgresUser: false, onLog: () => {}, onError: () => {}, postgresFlags: ['-h', '127.0.0.1'] });
const clients = [];
const file = name => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const id = n => `41100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), other = id(2), day = id(3), meal = id(4), metric = id(5), archived = id(6);
const date = '2026-09-20';
let started = false;
async function connect() { const c = pg.getPgClient(); clients.push(c); await c.connect(); return c; }
async function role(c, user = owner) {
  await c.query('set role authenticated');
  await c.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function read(c, selected = date) {
  return (await c.query('select public.mobile_read_nutrition_day($1) as data', [selected])).rows[0].data;
}
try {
  await pg.initialise(); await pg.start(); started = true;
  const admin = await connect(), reader = await connect(), blocker = await connect();
  await admin.query(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const name of ['0001.sql', '20260426_0004_phase1_remove_meal_status.sql', '20260813150000_nutrition_schema_foundation.sql']) await admin.query(await file(name));
  const overrides = await file('20260909180000_daily_nutrition_overrides_v2.sql');
  await admin.query(overrides.slice(0, overrides.indexOf('create or replace function')) + 'commit;');
  await admin.query(await file('20260909155017_configurable_daily_metrics.sql'));
  await admin.query('grant select,insert,update on public.day_logs,public.meal_entries to authenticated');
  await admin.query(await file('20261003021157_mobile_nutrition_day_read.sql'));
  await admin.query('insert into auth.users values($1),($2)', [owner, other]);
  await admin.query('insert into public.day_logs(id,user_id,log_date,nutrition_target_kcal_snapshot,estimated_expenditure_kcal_snapshot) values($1,$2,$3,1800,2200)', [day, owner, date]);
  await admin.query("insert into public.meal_entries(id,user_id,day_log_id,title,final_calories,final_protein_g,final_carbs_g,final_fat_g) values($1,$2,$3,'Meal',200,null,20,0)", [meal, owner, day]);
  await admin.query('update public.day_logs set total_carbs_g=20,delta_vs_nutrition_target=-1600,energy_balance_kcal=-2000 where id=$1', [day]);
  await admin.query("insert into public.user_metrics(id,user_id,name,value_type,unit,target_value) values($1,$2,'Agua personal','decimal','L',2)", [metric, owner]);
  await admin.query("insert into public.user_metrics(id,user_id,name,value_type,is_active,archived_at) values($1,$2,'Anterior','integer',false,now())", [archived, owner]);
  await admin.query('insert into public.daily_metric_values(user_id,metric_id,metric_date,value) values($1,$2,$3,0),($1,$2,$4,5),($1,$5,$3,7)', [owner, metric, date, '2026-09-19', archived]);
  await role(reader);
  const data = await read(reader);
  assert.equal(data.nutrition.data.dayLog.total_calories_consumed, 200);
  assert.equal(data.nutrition.data.meals[0].final_protein_g, null);
  assert.equal(data.nutrition.data.meals[0].final_fat_g, 0);
  assert.equal(data.activity.data.metrics.find(m => m.id === metric).value, 0);
  assert.equal(data.activity.data.metrics.find(m => m.id === archived).value, 7);
  assert.equal((await read(reader, '2026-09-18')).activity.data.metrics[0].value, null); // no latest-date fallback
  const before = (await admin.query('select count(*)::integer as n from public.day_logs')).rows[0].n;
  await reader.query('begin read only');
  assert.equal((await read(reader, '2026-09-18')).nutrition.data.dayLog, null);
  const current = (await reader.query("select (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text as day")).rows[0].day;
  assert.equal((await read(reader, current)).today, current);
  await reader.query('commit');
  assert.equal((await admin.query('select count(*)::integer as n from public.day_logs')).rows[0].n, before);
  await admin.query('insert into public.day_logs(user_id,log_date) values($1,$2)', [owner, '2026-09-17']);
  assert.deepEqual((await read(reader, '2026-09-17')).nutrition.data.meals, []);
  await role(reader, other);
  assert.equal((await read(reader)).nutrition.data.dayLog, null);
  assert.deepEqual((await read(reader)).activity.data.metrics, []);
  await reader.query('reset role; set role anon');
  await assert.rejects(() => read(reader), e => e.code === '42501');
  await reader.query('reset role'); await role(reader, '');
  await assert.rejects(() => read(reader), /not_authenticated/);
  await role(reader);
  await admin.query('revoke select on public.user_metrics from authenticated');
  assert.equal((await read(reader)).nutrition.status, 'ok');
  assert.equal((await read(reader)).activity.status, 'unavailable');
  await admin.query('grant select on public.user_metrics to authenticated; revoke select on public.day_logs from authenticated');
  assert.equal((await read(reader)).nutrition.status, 'unavailable');
  assert.equal((await read(reader)).activity.status, 'ok');
  await admin.query('grant select on public.day_logs to authenticated');

  // Deterministic race: pause the meal SELECT, commit a full new day/meal/metric,
  // then release the SELECT. Every section must still see its original snapshot.
  await admin.query(`create function public.test_read_gate() returns boolean language plpgsql volatile as $$
    begin if current_setting('test.read_gate',true)='on' then perform pg_advisory_xact_lock(411001); end if; return true; end $$;
    create policy test_gate on public.meal_entries as restrictive for select to authenticated using(public.test_read_gate());`);
  await blocker.query('begin; select pg_advisory_xact_lock(411001)');
  await reader.query("set test.read_gate='on'");
  const pid = (await reader.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pending = read(reader);
  let waiting = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if ((await admin.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock') { waiting = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(waiting, 'Expected read gate lock');
  await admin.query('begin');
  await admin.query('update public.meal_entries set final_calories=300 where id=$1', [meal]);
  await admin.query('update public.daily_metric_values set value=1 where metric_id=$1 and metric_date=$2', [metric, date]);
  await admin.query('commit');
  await blocker.query('commit');
  const concurrent = await pending;
  assert.equal(concurrent.nutrition.data.dayLog.total_calories_consumed, 200);
  assert.equal(concurrent.nutrition.data.meals[0].final_calories, 200);
  assert.equal(concurrent.activity.data.metrics.find(m => m.id === metric).value, 0);
  const fresh = await read(reader);
  assert.equal(fresh.nutrition.data.dayLog.total_calories_consumed, 300);
  assert.equal(fresh.nutrition.data.meals[0].final_calories, 300);
  assert.equal(fresh.activity.data.metrics.find(m => m.id === metric).value, 1);
  const metadata = (await admin.query("select provolatile,prosecdef from pg_proc where oid='public.mobile_read_nutrition_day(date)'::regprocedure")).rows[0];
  assert.deepEqual(metadata, { provolatile: 's', prosecdef: false });
  console.log('PASS Nutrition exact-date PostgreSQL: read-only, snapshots, missing/empty, ownership/RLS, independent availability, concurrent coherent read.');
} finally {
  // Release gates even after assertion failures so readers can finish.
  await Promise.all(clients.map(c => c.query('rollback').catch(() => {})));
  await Promise.all(clients.map(c => c.end().catch(() => {})));
  if (started) await pg.stop();
  await rm(directory, { recursive: true, force: true });
}
