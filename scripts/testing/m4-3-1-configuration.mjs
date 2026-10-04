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
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m431-'));
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
  await admin.query(await file('20261004175844_mobile_nutrition_configuration.sql'));
  const read=async(op,c=a)=>(await c.query('select public.mobile_configuration_state($1) d',[op])).rows[0].d;
  const mutate=async(i,c=a)=>(await c.query('select * from public.mobile_mutate_nutrition_configuration($1)',[JSON.stringify(i)])).rows[0];
  const intent=async(op,fields,key,c=a)=>({operation:op,date:today,fields,expectedVersion:(await read(op,c)).version,idempotencyKey:key});
  const plan={name:'Etapa',baseWaterL:2,trainingCalorieDeltaKcal:200,trainingWaterDeltaL:0.5,weekdays:Array.from({length:7},(_,i)=>({weekday:i+1,calorieTargetKcal:2000+i,proteinTargetG:i===0?0:120.25}))};
  const energy={activityLevel:'moderate',baseExpenditureMode:'automatic',customBaseExpenditureKcal:null,trainingExpenditureDeltaKcal:300};
  const physical={birthDate:'1990-01-01',sex:'male',heightCm:180,weightKg:80.25};
  await check('read absence, independent availability, exact Cordoba date, no materialization',async()=>{
   const r=(await a.query('select public.mobile_read_nutrition_configuration() d')).rows[0].d;assert.equal(r.today,today);assert.equal(r.plan.data.parent,null);assert.equal(r.physical.data.profile,null);
   assert.equal((await admin.query('select count(*)::int n from day_logs')).rows[0].n,0);
  });
  await check('legacy fallback is versioned, adoption is explicit and future periods untouched',async()=>{
   await stranger.query("insert into nutrition_goal_periods(user_id,effective_from,name,calories_no_gym,calories_gym,protein_no_gym_g,protein_gym_g,water_no_gym_l,water_gym_l) values($1,$2,'Legacy',1800,2100,90,110,2,2.5)",[other,yesterday]);
   assert.equal((await read('plan',stranger)).parent,null);assert.equal((await read('plan',stranger)).legacy.name,'Legacy');
   const tomorrow=(await admin.query('select ($1::date+1)::text d',[today])).rows[0].d;
   await admin.query("insert into nutrition_plan_periods(user_id,effective_from,name,base_water_l,training_calorie_delta_kcal,training_water_delta_l) values($1,$2,'Future',2,0,0)",[other,tomorrow]);
   await mutate(await intent('plan',plan,'adopt',stranger),stranger);
   assert.equal((await read('plan',stranger)).parent.effective_from,today);assert.equal((await admin.query('select name from nutrition_plan_periods where user_id=$1 and effective_from=$2',[other,tomorrow])).rows[0].name,'Future');
   assert.equal((await admin.query('select name from nutrition_goal_periods where user_id=$1',[other])).rows[0].name,'Legacy');
  });
  await check('first plan creation race has one winner and explicit conflict',async()=>{
   const one=await intent('plan',plan,'first'),two={...one,idempotencyKey:'second',fields:{...plan,name:'Second'}};
   const r=await Promise.all([mutate(one,a),mutate(two,b)]);assert.deepEqual(r.map(x=>x.response_status).sort(),[200,409]);assert.equal(r.find(x=>x.response_status===409).response_body.error,'CONFIG_CHANGED');
   assert.equal((await admin.query('select count(*)::int n from nutrition_plan_periods where user_id=$1',[owner])).rows[0].n,1);assert.equal((await read('plan')).weekdays.length,7);
  });
  await check('plan normalized replay, different payload, metadata CAS and weekday CAS',async()=>{
   const i=await intent('plan',plan,'plan-save'),r=await mutate(i);assert.equal(r.response_status,200);
   assert.equal((await mutate({...i,fields:{...plan,name:' Etapa ',weekdays:[...plan.weekdays].reverse()}})).replayed,true);
   assert.equal((await mutate({...i,fields:{...plan,name:'Other'}})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
   const stale=await intent('plan',plan,'stale-weekday');await b.query('update nutrition_plan_weekdays set protein_target_g=123 where plan_id=$1 and weekday=2',[(await read('plan')).parent.id]);
   assert.equal((await mutate(stale)).response_body.error,'CONFIG_CHANGED');
   const staleMeta=await intent('plan',plan,'stale-metadata');await b.query('update nutrition_plan_periods set name=$1 where id=$2',['WEB',(await read('plan')).parent.id]);assert.equal((await mutate(staleMeta)).response_body.error,'CONFIG_CHANGED');
   const before=await read('plan');await assert.rejects(mutate(await intent('plan',{...plan,weekdays:plan.weekdays.slice(1)},'invalid-week')));assert.deepEqual(await read('plan'),before);
  });
  await check('waiting on concurrent Web weekday edit rereads truth inside transaction',async()=>{
   const i=await intent('plan',plan,'wait-web');await b.query('begin');await b.query('update nutrition_plan_weekdays set calorie_target_kcal=3000 where plan_id=$1 and weekday=3',[(await read('plan')).parent.id]);
   const pending=mutate(i,a);await new Promise(r=>setTimeout(r,40));await b.query('commit');assert.equal((await pending).response_body.error,'CONFIG_CHANGED');assert.equal((await read('plan')).weekdays.find(w=>w.weekday===3).calorie_target_kcal,3000);
  });
  await check('energy custom and automatic require BMR; physical save atomic weight/BMR/today',async()=>{
   assert.equal((await mutate(await intent('energy',{...energy,baseExpenditureMode:'custom',customBaseExpenditureKcal:2500},'no-bmr'))).response_body.error,'ENERGY_PROFILE_REQUIRED');
   const i=await intent('physical',physical,'physical-create'),r=await mutate(i);assert.equal(r.response_status,200);assert.equal(r.response_body.weightRecorded,true);
   const profile=(await read('physical')).profile;assert.equal(profile.current_weight_kg,80.25);assert.ok(profile.bmr_kcal_current>0);assert.equal((await read('physical')).latestWeight.date,today);
   const d=(await admin.query('select * from day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0];assert.equal(Number(d.weight_kg),80.25);assert.equal(d.bmr_kcal_snapshot,profile.bmr_kcal_current);
   assert.equal((await mutate(i)).replayed,true);
   const before=await read('physical');await assert.rejects(mutate(await intent('physical',{...physical,heightCm:251},'bad-height')));assert.deepEqual(await read('physical'),before);
   assert.equal((await mutate(await intent('physical',{...physical,weightKg:null},'no-clear-history'))).response_body.error,'PHYSICAL_WEIGHT_REQUIRED');
  });
  await check('energy inputs, custom mode, physical CAS and input fingerprint',async()=>{
   const i=await intent('energy',energy,'energy-first');assert.equal((await mutate(i)).response_status,200);assert.equal((await read('energy')).parent.activity_factor,1.25);
   const old=await intent('energy',energy,'energy-stale-physical'),oldPhysical=await intent('physical',physical,'physical-stale');
   await b.query('update profiles set height_cm=181 where user_id=$1',[owner]);assert.equal((await mutate(old)).response_body.error,'CONFIG_CHANGED');assert.equal((await mutate(oldPhysical)).response_body.error,'PHYSICAL_CHANGED');
   const custom={...energy,activityLevel:'high',baseExpenditureMode:'custom',customBaseExpenditureKcal:2600};const r=await mutate(await intent('energy',custom,'custom'));assert.equal(r.response_status,200);assert.equal((await read('energy')).parent.custom_base_expenditure_kcal,2600);
   assert.equal((await mutate(await intent('physical',{...physical,weightKg:81.5},'weight'))).response_status,200);assert.equal((await read('physical')).profile.current_weight_kg,81.5);
  });
  await check('ownership, shared profile fields, second user and absence races',async()=>{
   assert.equal((await read('plan',stranger)).parent.user_id,other);assert.equal((await read('physical',stranger)).profile,null);
   const foreign=await intent('physical',physical,'foreign');assert.equal((await mutate(foreign,stranger)).response_body.error,'PHYSICAL_CHANGED');
   const empty=await intent('physical',{...physical,weightKg:50},'empty-physical',stranger);const p=await Promise.all([mutate(empty,stranger),mutate({...empty,idempotencyKey:'empty-physical-2'},await (async()=>{const c=await connect();await role(c,other);return c;})())]);assert.deepEqual(p.map(x=>x.response_status).sort(),[200,409]);
   await a.query("update profiles set display_name='Original' where user_id=$1",[owner]);await mutate(await intent('physical',{...physical,weightKg:81},'display'));assert.equal((await a.query('select display_name from profiles where user_id=$1',[owner])).rows[0].display_name,'Original');
  });
  await check('today refresh, historical snapshots, BMR and daily overrides remain independent',async()=>{
   const historical=(await a.query('select (public.get_or_create_day_log($1)).id id',[yesterday])).rows[0].id;
   await a.query('select public.refresh_nutrition_day($1)',[historical]);const old=(await admin.query('select * from day_logs where id=$1',[historical])).rows[0];
   await a.query('update day_logs set nutrition_target_override_kcal=3100,expenditure_override_kcal=3200 where user_id=$1 and log_date=$2',[owner,today]);
   await mutate(await intent('plan',{...plan,weekdays:plan.weekdays.map(w=>({...w,calorieTargetKcal:2700}))},'historical-plan'));
   await mutate(await intent('energy',{...energy,trainingExpenditureDeltaKcal:400},'historical-energy'));
   await mutate(await intent('physical',{...physical,weightKg:82},'historical-profile'));
   assert.deepEqual((await admin.query('select * from day_logs where id=$1',[historical])).rows[0],old);
   const d=(await admin.query('select * from day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0];assert.equal(d.nutrition_target_override_kcal,3100);assert.equal(d.expenditure_override_kcal,3200);assert.equal(d.nutrition_target_kcal_snapshot,3100);assert.equal(d.estimated_expenditure_kcal_snapshot,3200);
   await a.query('update day_logs set nutrition_target_override_kcal=null,expenditure_override_kcal=null where user_id=$1 and log_date=$2',[owner,today]);
   assert.equal((await admin.query('select nutrition_target_kcal_snapshot from day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0].nutrition_target_kcal_snapshot,2700);
  });
  await check('physical DB failure rolls back profile, weight, derived snapshots and ledger together',async()=>{
   const before=await read('physical'),dayBefore=(await admin.query('select * from day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0];
   await admin.query("create function public.fail_weight_test() returns trigger language plpgsql as $$begin raise exception 'test weight failure'; end$$; create trigger fail_weight_test before update of weight_kg on public.day_logs for each row execute function public.fail_weight_test();");
   const i=await intent('physical',{...physical,heightCm:190,weightKg:89},'atomic-failure');await assert.rejects(mutate(i));
   assert.deepEqual(await read('physical'),before);assert.deepEqual((await admin.query('select * from day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0],dayBefore);
   assert.equal((await admin.query("select count(*)::int n from mobile_idempotency_keys where user_id=$1 and idempotency_key='atomic-failure'",[owner])).rows[0].n,0);
   await admin.query('drop trigger fail_weight_test on public.day_logs; drop function public.fail_weight_test();');
  });
  await check('Web weight change invalidates physical and energy CAS; water metric target is independent',async()=>{
   const p=await intent('physical',physical,'web-weight-physical'),e=await intent('energy',energy,'web-weight-energy');
   await a.query('select public.ensure_user_metrics()');
   const before=(await admin.query("select target_value from user_metrics where user_id=$1 and system_key='water'",[owner])).rows;
   assert.equal(Number(before[0].target_value),2.5);
   await b.query('update day_logs set weight_kg=84 where user_id=$1 and log_date=$2',[owner,today]);
   assert.equal((await mutate(p)).response_body.error,'PHYSICAL_CHANGED');assert.equal((await mutate(e)).response_body.error,'CONFIG_CHANGED');
   await mutate(await intent('plan',{...plan,baseWaterL:3.5},'water-independent'));assert.deepEqual((await admin.query("select target_value from user_metrics where user_id=$1 and system_key='water'",[owner])).rows,before);
  });
  await check('unconfirmed old-day intent conflicts, confirmed old-day receipt replays without sources',async()=>{
   const old={...await intent('plan',plan,'midnight'),date:yesterday};assert.equal((await mutate(old)).response_body.error,'CONFIG_DAY_CHANGED');
   const confirmed={...await intent('plan',plan,'confirmed-before-midnight'),date:yesterday};const normalized={operation:confirmed.operation,date:confirmed.date,expectedVersion:confirmed.expectedVersion,fields:confirmed.fields};
   const receipt={status:'confirmed',operation:'plan',date:yesterday,version:'a'.repeat(64),weightRecorded:false};
   await admin.query("insert into mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,state,response_status,response_body,completed_at,expires_at) values($1,'nutrition.config.plan.v1',$2,public.mobile_quick_source_version($3::jsonb),'completed',200,$4::jsonb,now(),'infinity')",[owner,confirmed.idempotencyKey,JSON.stringify(normalized),JSON.stringify(receipt)]);
   const replay=await mutate(confirmed);assert.equal(replay.replayed,true);assert.deepEqual(replay.response_body,receipt);
  });
  console.log(`${checks} Postgres integration groups passed`);
}finally{await Promise.allSettled(clients.map(c=>c.end()));if(started)await pg.stop();await rm(directory,{recursive:true,force:true});}
