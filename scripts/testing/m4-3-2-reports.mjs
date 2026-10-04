// Disposable PostgreSQL 17: actual Nutrition schema, engine, triggers, ledger
// and Mobile RPC. No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-3-1-configuration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m432-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory,'db'), port, user:'postgres', password:'local-test',
  persistent:true, createPostgresUser:false, onLog:()=>{}, onError:()=>{}, postgresFlags:['-h','127.0.0.1'] });
const clients=[]; let started=false; let checks=0;
async function connect() { const c=pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=n=>`41300000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), other=id(2);
async function role(c,user=owner) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
async function check(name,run) { await run(); console.log(`PASS ${name}`); checks++; }
try {
  await pg.initialise(); await pg.start(); started=true;
  const admin=await connect(), a=await connect(), b=await connect(), stranger=await connect();
  await admin.query(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const name of ['0001.sql','20260426_0002_phase1_profiles_weight_and_checks.sql','20260426_0004_phase1_remove_meal_status.sql','20260813150000_nutrition_schema_foundation.sql']) await admin.query(await file(name));
  await admin.query('create table public.workout_sessions(id uuid primary key,user_id uuid,day_log_id uuid,status text)');
  for(const name of ['20260813133845_atomic_weight_and_current_day_snapshots.sql','20260813134351_centralize_profile_energy_derivation.sql','20260813163000_nutrition_day_engine.sql','20260813170000_nutrition_energy_sync.sql','20260908170000_nutrition_plan_energy_v2.sql','20260908220654_pr71_1_plan_energy_coherence.sql','20260909180000_daily_nutrition_overrides_v2.sql']) await admin.query(await file(name));
  const normalization=await file('20260426_0012_normalize_names_uppercase.sql');
  await admin.query(normalization.slice(normalization.indexOf('create or replace function'),normalization.indexOf('$$;',normalization.indexOf('create or replace function'))+3));
  await admin.query(await file('20260426_0013_normalize_meals_uppercase.sql'));
  const ledger=await file('20260927190000_mobile_training_api_expand.sql');
  await admin.query(ledger.slice(0,ledger.indexOf('create function public.mobile_create_training_routine'))+'commit;');
  for (const name of ['20260909155017_configurable_daily_metrics.sql','20260914104157_r3_atomic_daily_metric_values.sql','20261003021157_mobile_nutrition_day_read.sql','20261003040926_mobile_activity_context_writes.sql']) await admin.query(await file(name));
  await admin.query('insert into auth.users values($1),($2)',[owner,other]);
  await admin.query('grant select,insert,update,delete on public.day_logs,public.meal_entries to authenticated; grant select,insert,update on public.profiles,public.nutrition_goal_periods,public.expenditure_rule_periods to authenticated');
  await role(a); await role(b); await role(stranger,other);
  const blockers=await file('20260814010000_nutrition_import_blockers.sql');
  await admin.query(blockers.slice(0,blockers.indexOf('-- body_measurements'))+'commit;');
  for(const name of ['20260830171201_saved_meals.sql','20260908223000_food_calories_decimal.sql','20261004010134_mobile_quick_registration.sql']) await admin.query(await file(name));
  await admin.query('grant usage on schema extensions to authenticated; grant select on public.profiles, public.workout_sessions to authenticated');
  const today=(await admin.query("select (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text d")).rows[0].d;
  const yesterday=(await admin.query('select ($1::date-1)::text d',[today])).rows[0].d;
  await admin.query(await file('20261004183955_mobile_nutrition_reports.sql'));
  await admin.query(await file('20260814023000_allow_zero_calorie_sheet_imports.sql'));

  const snapshot=async(start=yesterday,end=today,c=a,expected=today)=>(await c.query('select public.mobile_read_nutrition_report($1,$2,$3) d',[start,end,expected])).rows[0].d;
  await check('STABLE invoker, grants, Córdoba date and no historical materialization',async()=>{
    const p=(await admin.query("select provolatile,prosecdef from pg_proc where proname='mobile_read_nutrition_report'")).rows[0];assert.equal(p.provolatile,'s');assert.equal(p.prosecdef,false);
    const absent=await snapshot();assert.equal(absent.status,'ok');assert.equal(absent.today,today);assert.deepEqual(absent.dayLogs,[]);assert.deepEqual(absent.meals,[]);
    assert.equal((await admin.query('select count(*)::int n from day_logs')).rows[0].n,0);
    const permissions=(await admin.query("select has_function_privilege('anon','public.mobile_read_nutrition_report(date,date,date)','execute') anon,has_function_privilege('authenticated','public.mobile_read_nutrition_report(date,date,date)','execute') authed")).rows[0];assert.equal(permissions.anon,false);assert.equal(permissions.authed,true);
  });
  await check('bounded period, future excluded and midnight coordination',async()=>{
    await assert.rejects(snapshot('2020-01-01',today));await assert.rejects(snapshot(today,'2099-01-01'));await assert.rejects(snapshot(today,yesterday));
    assert.equal((await snapshot(yesterday,today,a,yesterday)).status,'day_changed');
    const d=(await admin.query('select ($1::date-365)::text d',[today])).rows[0].d;assert.equal((await snapshot(d)).status,'ok');
  });
  const day=(await a.query('select (public.get_or_create_day_log($1)).id id',[yesterday])).rows[0].id;
  const oldDate=(await admin.query('select ($1::date-30)::text d',[today])).rows[0].d;
  const imported=(await a.query('select (public.get_or_create_day_log($1)).id id',[oldDate])).rows[0].id;
  await a.query("insert into meal_entries(id,user_id,day_log_id,title,final_calories,final_protein_g,final_carbs_g,final_fat_g) values($1,$2,$3,'One',200,null,20,0)",[id(10),owner,day]);
  await a.query("insert into meal_entries(id,user_id,day_log_id,title,final_calories,final_protein_g,final_carbs_g,final_fat_g) values($1,$2,$3,'Two',300,30,null,0)",[id(11),owner,day]);
  await a.query("insert into meal_entries(id,user_id,day_log_id,title,entry_kind,source_type,legacy_import_source,legacy_import_id,precision_level,final_calories,final_protein_g,final_carbs_g,final_fat_g) values($1,$2,$3,'Historical','legacy_daily_summary','sheet_import','test','historical-zero','historical',0,0,null,null)",[id(12),owner,imported]);
  await a.query('update day_logs set nutrition_target_override_kcal=1900,expenditure_override_kcal=2200 where id=$1',[day]);
  await a.query('select public.refresh_nutrition_day($1)',[day]);
  await check('persisted historical effective snapshots, explicit zero, unknown/partial facts',async()=>{
    const r=await snapshot(oldDate);assert.equal(r.dayLogs.length,2);assert.equal(r.meals.length,3);
    const d=r.dayLogs.find(d=>d.id===day);assert.equal(d.total_calories_consumed,500);assert.equal(d.nutrition_target_kcal_snapshot,1900);assert.equal(d.estimated_expenditure_kcal_snapshot,2200);assert.equal(d.delta_vs_nutrition_target,-1400);assert.equal(d.energy_balance_kcal,-1700);
    const zero=r.meals.find(m=>m.day_log_id===imported);assert.equal(zero.final_calories,0);assert.equal(zero.final_carbs_g,null);
    assert.equal(r.meals.filter(m=>m.day_log_id===day&&m.final_protein_g===null).length,1);
  });
  await check('second-user isolation supplementing RLS on every source',async()=>{
    const foreignDay=(await stranger.query('select (public.get_or_create_day_log($1)).id id',[yesterday])).rows[0].id;
    await stranger.query("insert into meal_entries(user_id,day_log_id,title,final_calories) values($1,$2,'Private',900)",[other,foreignDay]);
    const r=await snapshot(oldDate),s=await snapshot(oldDate,today,stranger);assert.ok(!r.dayLogs.some(d=>d.id===foreignDay));assert.ok(r.meals.every(m=>m.day_log_id!==foreignDay));assert.deepEqual(s.dayLogs.map(d=>d.id),[foreignDay]);assert.equal(s.meals.length,1);
  });
  await check('coherent old/new totals and meal facts across an uncommitted write',async()=>{
    await b.query('begin');await b.query('update meal_entries set final_calories=700 where id=$1',[id(10)]);
    const before=await snapshot();assert.equal(before.dayLogs[0].total_calories_consumed,500);assert.equal(before.meals.reduce((n,m)=>n+m.final_calories,0),500);
    await b.query('commit');const after=await snapshot();assert.equal(after.dayLogs[0].total_calories_consumed,1000);assert.equal(after.meals.reduce((n,m)=>n+m.final_calories,0),1000);
  });
  await check('soft-deleted meals omitted; stored totals follow server engine',async()=>{
    await b.query('update meal_entries set deleted_at=now() where id=$1',[id(11)]);const r=await snapshot();assert.equal(r.meals.length,1);assert.equal(r.dayLogs[0].total_calories_consumed,700);
  });
  await check('failed required source is unavailable, not an empty/partial mixed snapshot',async()=>{
    await admin.query('revoke select on meal_entries from authenticated');assert.equal((await snapshot()).status,'unavailable');await admin.query('grant select on meal_entries to authenticated');assert.equal((await snapshot()).status,'ok');
  });
  await check('today included; read does not update or create any persisted facts',async()=>{
    const todayDay=(await a.query('select (public.get_or_create_day_log($1)).id id',[today])).rows[0].id;await a.query("insert into meal_entries(user_id,day_log_id,title,final_calories) values($1,$2,'Today',100)",[owner,todayDay]);
    const before=(await admin.query('select * from day_logs order by id')).rows;const r=await snapshot(oldDate);assert.ok(r.dayLogs.some(d=>d.log_date===today));assert.deepEqual((await admin.query('select * from day_logs order by id')).rows,before);
  });
  console.log(`${checks} Postgres report integration groups passed`);
}finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)await pg.stop();await rm(directory,{recursive:true,force:true});}
