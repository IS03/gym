// Disposable PostgreSQL 17: actual Nutrition schema, engine, triggers, ledger
// and Mobile RPC. No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-1-2-manual-meal.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m413-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory,'db'), port, user:'postgres', password:'local-test',
  persistent:true, createPostgresUser:false, onLog:()=>{}, onError:()=>{}, postgresFlags:['-h','127.0.0.1'] });
const clients=[]; let started=false; let checks=0;
async function connect() { const c=pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=n=>`41300000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), other=id(2), date='2026-09-20', destination='2026-09-19';
async function role(c,user=owner) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
const fields=(patch={})=>({date,title:' pasta ',description:null,calories:200,proteinG:null,carbsG:20.25,fatG:0,...patch});
const create=(key,patch={},forceDuplicate=false)=>({operation:'create',sourceDate:date,mealId:null,expectedUpdatedAt:null,idempotencyKey:key,fields:fields(patch),forceDuplicate});
const mutate=async(c,intent)=>(await c.query('select * from public.mobile_mutate_nutrition_day($1::jsonb)',[JSON.stringify(intent)])).rows[0];
const edit=(mealId,expectedUpdatedAt,key,patch={},sourceDate=date)=>({operation:'edit',sourceDate,mealId,expectedUpdatedAt,idempotencyKey:key,fields:fields(patch),forceDuplicate:false});
const remove=(mealId,expectedUpdatedAt,key,sourceDate=date)=>({operation:'delete',sourceDate,mealId,expectedUpdatedAt,idempotencyKey:key,fields:null,forceDuplicate:false});
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
  for(const name of ['20260813163000_nutrition_day_engine.sql','20260813170000_nutrition_energy_sync.sql','20260908170000_nutrition_plan_energy_v2.sql','20260909180000_daily_nutrition_overrides_v2.sql']) await admin.query(await file(name));
  const normalization=await file('20260426_0012_normalize_names_uppercase.sql');
  await admin.query(normalization.slice(normalization.indexOf('create or replace function'),normalization.indexOf('$$;',normalization.indexOf('create or replace function'))+3));
  await admin.query(await file('20260426_0013_normalize_meals_uppercase.sql'));
  const ledger=await file('20260927190000_mobile_training_api_expand.sql');
  await admin.query(ledger.slice(0,ledger.indexOf('create function public.mobile_create_training_routine'))+'commit;');
  for (const name of ['20260909155017_configurable_daily_metrics.sql','20260914104157_r3_atomic_daily_metric_values.sql','20261003021157_mobile_nutrition_day_read.sql','20261003040926_mobile_activity_context_writes.sql']) await admin.query(await file(name));
  await admin.query('insert into auth.users values($1),($2)',[owner,other]);
  await admin.query('grant select,insert,update on public.day_logs,public.meal_entries to authenticated');
  await role(a); await role(b); await role(stranger,other);
  await a.query('select public.ensure_user_metrics()'); await stranger.query('select public.ensure_user_metrics()');
  await admin.query("insert into public.user_metrics(user_id,name,unit,value_type) values($1,'Personal','u','decimal')",[owner]);
  const definitions=(await admin.query('select *,updated_at::text version from public.user_metrics where user_id=$1',[owner])).rows;
  const m=key=>definitions.find(m=>m.system_key===key||m.name===key);
  const version=async(metricId,dt=date)=>(await admin.query('select updated_at::text v from public.daily_metric_values where user_id=$1 and metric_id=$2 and metric_date=$3',[owner,metricId,dt])).rows[0]?.v??null;
  const change=async(key,value,dt=date)=>({metricId:m(key).id,definitionUpdatedAt:m(key).version,expectedUpdatedAt:await version(m(key).id,dt),value});
  const metrics=(key,changes,dt=date)=>({operation:'metrics',date:dt,idempotencyKey:key,changes});
  const val=async(key,dt=date)=>(await admin.query('select value from public.daily_metric_values where user_id=$1 and metric_id=$2 and metric_date=$3',[owner,m(key).id,dt])).rows[0]?.value??null;
  await check('set batch, zero, decimal and duration; no day fabricated',async()=>{
    const r=await mutate(a,metrics('first',[await change('steps',0),await change('water',2.1234),await change('sleep',485),await change('Personal',1.25)]));
    const replay=metrics('first',[await change('steps',0),await change('water',2.1234),await change('sleep',485),await change('Personal',1.25)]);
    replay.changes.forEach(c=>{c.expectedUpdatedAt=null;});replay.changes.reverse();assert.equal((await mutate(a,replay)).replayed,true);
    assert.equal(r.response_status,200); assert.equal(Number(await val('steps')),0);assert.equal(Number(await val('water')),2.1234);assert.equal(Number(await val('sleep')),485);
    assert.equal((await admin.query('select count(*)::integer n from public.day_logs')).rows[0].n,0);
  });
  await check('update/unset, replay and different payload',async()=>{
    const i=metrics('second',[await change('water',0),await change('Personal',null)]);
    assert.equal((await mutate(a,i)).response_status,200);assert.equal(await val('Personal'),null);assert.equal(Number(await val('water')),0);
    assert.equal((await mutate(a,i)).replayed,true); assert.equal((await mutate(a,{...i,changes:[{...i.changes[0],value:3}]})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
  });
  await check('batch CAS conflict rolls back all values',async()=>{
    const i=metrics('stale',[await change('water',4),await change('sleep',500)]);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,true)',[date,JSON.stringify({[m('sleep').id]:490})]);
    assert.equal((await mutate(a,i)).response_body.error,'METRICS_CHANGED');assert.equal(Number(await val('water')),0);assert.equal(Number(await val('sleep')),490);
  });
  await check('value types and validation cannot partially save batch',async()=>{
    let badKey=0;
    for(const patch of [{value:-1},{value:1.12345},{metricId:id(99)},{value:1.5}]) {
      const bad={...await change('steps',8),...patch};
      if(patch.metricId) assert.equal((await mutate(a,metrics('bad-owner',[await change('water',3),bad]))).response_body.error,'METRIC_UNAVAILABLE');
      else await assert.rejects(mutate(a,metrics('bad:'+ ++badKey,[await change('water',3),bad])));
      assert.equal(Number(await val('water')),0);
    }
  });
  await check('definition version conflict and ownership',async()=>{
    const i=metrics('definition',[await change('Personal',2)]);
    await admin.query('update public.user_metrics set name=name||\' new\' where id=$1',[m('Personal').id]);
    assert.equal((await mutate(a,i)).response_body.error,'METRICS_CHANGED');
    assert.equal((await mutate(stranger,metrics('foreign',[await change('water',3)]))).response_body.error,'METRIC_UNAVAILABLE');
    assert.equal((await stranger.query('select count(*)::integer n from public.daily_metric_values where user_id=$1',[owner])).rows[0].n,0);
  });
  await check('archived historical correction and unset; no new archived values',async()=>{
    await admin.query('update public.user_metrics set is_active=false,archived_at=now() where id=$1',[m('sleep').id]);
    m('sleep').version=(await admin.query('select updated_at::text v from public.user_metrics where id=$1',[m('sleep').id])).rows[0].v;
    assert.equal((await mutate(a,metrics('archived-correct',[await change('sleep',480)]))).response_status,200);
    assert.equal((await mutate(a,metrics('archived-new',[await change('sleep',1,destination)],destination))).response_body.error,'METRIC_UNAVAILABLE');
    assert.equal((await mutate(a,metrics('archived-unset',[await change('sleep',null)]))).response_status,200);
    assert.equal((await mutate(a,metrics('archived-recreate',[await change('sleep',1)]))).response_body.error,'METRIC_UNAVAILABLE');
    assert.equal((await admin.query('select is_active from public.user_metrics where id=$1',[m('sleep').id])).rows[0].is_active,false);
  });
  await check('concurrent Web change cannot be overwritten; no partial batch',async()=>{
    const i=metrics('web-race',[await change('water',4),await change('steps',10)]);
    await b.query('begin');await b.query('update public.daily_metric_values set value=1 where metric_id=$1 and user_id=$2 and metric_date=$3',[m('steps').id,owner,date]);
    const pending=mutate(a,i);await new Promise(r=>setTimeout(r,120));await b.query('commit');
    assert.equal((await pending).response_body.error,'METRICS_CHANGED');assert.equal(Number(await val('water')),0);assert.equal(Number(await val('steps')),1);
  });
  await check('concurrent absent value creation never overwrites or partially saves',async()=>{
    const i=metrics('absent-race',[await change('water',4),await change('mate',2)]);
    await b.query('begin');await b.query('insert into public.daily_metric_values(user_id,metric_id,metric_date,value) values($1,$2,$3,7)',[owner,m('mate').id,date]);
    const pending=mutate(a,i);await new Promise(r=>setTimeout(r,120));await b.query('commit');
    assert.equal((await pending).response_body.error,'METRICS_CHANGED');assert.equal(Number(await val('water')),0);assert.equal(Number(await val('mate')),7);
  });
  await check('competing Mobile CAS yields one success',async()=>{
    const base=await change('water',1); const results=await Promise.all([mutate(a,metrics('race1',[base])),mutate(b,metrics('race2',[{...base,value:2}]))]);
    assert.deepEqual(results.map(r=>r.response_status).sort(),[200,409]);
  });
  // Historical fixture has explicit automatic snapshots: no current configuration
  // is substituted when setting or clearing a daily override.
  const day=(await admin.query("insert into public.day_logs(user_id,log_date,nutrition_target_automatic_kcal_snapshot,estimated_expenditure_automatic_kcal_snapshot,nutrition_target_kcal_snapshot,estimated_expenditure_kcal_snapshot,nutrition_resolved_at,total_calories_consumed) values($1,$2,1800,2200,1800,2200,now(),200) returning id",[owner,date])).rows[0].id;
  await admin.query("insert into public.day_logs(user_id,log_date,nutrition_target_kcal_snapshot) values($1,$2,1700)",[owner,destination]);
  const ctx=async(key,changes,dt=date)=>({operation:'context',date:dt,idempotencyKey:key,expectedUpdatedAt:(await admin.query('select updated_at::text v from public.day_logs where user_id=$1 and log_date=$2',[owner,dt])).rows[0]?.v??'2026-09-20T00:00:00Z',changes});
  await admin.query("insert into public.nutrition_plan_periods(user_id,effective_from,name,base_water_l) values($1,'2026-09-01','Existing plan',3)",[owner]);
  await admin.query("insert into public.energy_config_periods(user_id,effective_from,activity_level,activity_factor) values($1,'2026-09-01','low',1.20)",[owner]);
  const originalSnapshot=(await admin.query('select * from public.day_logs where id=$1',[day])).rows[0];
  const beforeConfig=(await admin.query('select (select count(*) from public.nutrition_plan_periods) p,(select count(*) from public.energy_config_periods) e')).rows[0];
  await check('context set/edit/clear and effective values; other dates unchanged',async()=>{
    const i=await ctx('context-first',{target:{action:'set',value:1900},expenditure:{action:'set',value:2400}});
    assert.equal((await mutate(a,i)).response_status,200);assert.equal((await mutate(a,i)).replayed,true);
    assert.equal((await mutate(a,{...i,changes:{target:{action:'set',value:1950}}})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    let d=(await admin.query('select * from public.day_logs where id=$1',[day])).rows[0];
    assert.equal(d.nutrition_plan_period_id,originalSnapshot.nutrition_plan_period_id);assert.equal(d.energy_config_period_id,originalSnapshot.energy_config_period_id);
    for(const field of ['protein_target_g_snapshot','water_target_l_snapshot','work_effective_snapshot','gym_effective_snapshot','bmr_kcal_snapshot','target_kcal_snapshot'])assert.equal(d[field],originalSnapshot[field]);
    assert.equal(d.nutrition_target_kcal_snapshot,1900);assert.equal(d.estimated_expenditure_kcal_snapshot,2400);assert.equal(d.delta_vs_nutrition_target,-1700);assert.equal(d.energy_balance_kcal,-2200);
    assert.equal((await mutate(a,await ctx('context-edit',{target:{action:'set',value:1950}}))).response_status,200);
    assert.equal((await mutate(a,await ctx('context-clear',{target:{action:'clear'},expenditure:{action:'clear'}}))).response_status,200);
    d=(await admin.query('select * from public.day_logs where id=$1',[day])).rows[0];assert.equal(d.nutrition_target_kcal_snapshot,1800);assert.equal(d.estimated_expenditure_kcal_snapshot,2200);assert.equal(d.nutrition_target_override_kcal,null);assert.equal(d.expenditure_override_kcal,null);
    assert.equal((await admin.query('select nutrition_target_kcal_snapshot v from public.day_logs where user_id=$1 and log_date=$2',[owner,destination])).rows[0].v,1700);
    assert.deepEqual((await admin.query('select (select count(*) from public.nutrition_plan_periods) p,(select count(*) from public.energy_config_periods) e')).rows[0],beforeConfig);
  });
  await check('context CAS, second user, missing day and validation',async()=>{
    const i=await ctx('ctx-stale',{target:{action:'set',value:2000}});
    await b.query('update public.day_logs set expenditure_override_kcal=2500 where id=$1',[day]);
    assert.equal((await mutate(a,i)).response_body.error,'CONTEXT_CHANGED');
    assert.equal((await mutate(stranger,i)).response_body.error,'CONTEXT_UNAVAILABLE');
    assert.equal((await mutate(a,await ctx('missing',{target:{action:'set',value:1800}},'2026-09-01'))).response_body.error,'CONTEXT_UNAVAILABLE');
    for(const value of [0,-1,20001,1.5]) await assert.rejects(mutate(a,await ctx('ctx-bad:'+value,{target:{action:'set',value}})));
    assert.equal((await admin.query("select count(*)::integer n from public.day_logs where log_date='2026-09-01'")).rows[0].n,0);
  });
  await check('context locked CAS rejects concurrent Web update',async()=>{
    const i=await ctx('ctx-concurrent',{target:{action:'set',value:2050}});
    await b.query('begin');await b.query('update public.day_logs set nutrition_target_override_kcal=2100 where id=$1',[day]);
    const pending=mutate(a,i);await new Promise(r=>setTimeout(r,120));await b.query('commit');
    assert.equal((await pending).response_body.error,'CONTEXT_CHANGED');assert.equal((await admin.query('select nutrition_target_override_kcal v from public.day_logs where id=$1',[day])).rows[0].v,2100);
  });
  await check('sleep-like personal duration versions independently of day_log, including today',async()=>{
    const today=(await admin.query("select (now() at time zone 'America/Argentina/Cordoba')::date::text d")).rows[0].d;
    await admin.query("insert into public.user_metrics(user_id,name,unit,value_type) values($1,'Duration2','min','duration')",[owner]);
    definitions.push((await admin.query("select *,updated_at::text version from public.user_metrics where user_id=$1 and name='Duration2'",[owner])).rows[0]);
    await admin.query('insert into public.day_logs(user_id,log_date) values($1,$2)',[owner,today]);
    const before=(await admin.query('select updated_at::text v from public.day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0].v;
    assert.equal((await mutate(a,metrics('today-duration',[await change('Duration2',480,today)],today))).response_status,200);
    const i=metrics('today-stale-duration',[await change('Duration2',490,today)],today);
    await b.query('select public.save_daily_metric_values($1,$2::jsonb,false)',[today,JSON.stringify({[m('Duration2').id]:500})]);
    assert.equal((await admin.query('select updated_at::text v from public.day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0].v,before);
    assert.equal((await mutate(a,i)).response_body.error,'METRICS_CHANGED');assert.equal(Number(await val('Duration2',today)),500);
    assert.equal((await mutate(a,metrics('archived-today',[await change('sleep',1,today)],today))).response_body.error,'METRIC_UNAVAILABLE');
  });
  await check('legacy projection constraint failure rolls back whole batch',async()=>{
    const before=await val('water');await assert.rejects(mutate(a,metrics('projection-invalid',[await change('water',3),await change('steps',200001)])));
    assert.equal(await val('water'),before);
  });
  await check('read versions exact date and archived absence; public grants remain private',async()=>{
    const snapshot=(await a.query('select public.mobile_read_nutrition_day($1) d',[date])).rows[0].d;
    assert.ok(snapshot.nutrition.data.dayLog.updated_at);assert.ok(snapshot.activity.data.metrics.every(m=>m.definitionUpdatedAt));
    assert.equal(snapshot.activity.data.metrics.find(m=>m.systemKey==='sleep'),undefined);
    await assert.rejects(a.query('select * from public.mobile_idempotency_keys'));
    await admin.query('set role anon');await assert.rejects(admin.query('select * from public.mobile_mutate_nutrition_day($1::jsonb)',[JSON.stringify(metrics('anonymous',[]))]));await admin.query('reset role');
  });
  console.log(`PostgreSQL: ${checks} groups PASS`);
} finally {
  for(const c of clients) await c.end().catch(()=>{});
  if(started) await pg.stop(); await rm(directory,{recursive:true,force:true});
}
