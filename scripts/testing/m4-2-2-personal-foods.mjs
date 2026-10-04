// Disposable PostgreSQL 17: actual Nutrition schema, engine, triggers, ledger
// and Mobile RPC. No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-2-1-quick-registration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m422-'));
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
  const blockers=await file('20260814010000_nutrition_import_blockers.sql');
  await admin.query(blockers.slice(0,blockers.indexOf('-- body_measurements'))+'commit;');
  for(const name of ['20260830171201_saved_meals.sql','20260908223000_food_calories_decimal.sql','20261004010134_mobile_quick_registration.sql']) await admin.query(await file(name));
  await admin.query('grant usage on schema extensions to authenticated; grant select on public.profiles, public.workout_sessions to authenticated');
  const today=(await admin.query("select (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text d")).rows[0].d;
  const yesterday=(await admin.query('select ($1::date-1)::text d',[today])).rows[0].d;
  const oldSaved=(await a.query("insert into public.saved_meals(user_id,name,template_type,calories,protein_g,carbs_g,fat_g) values($1,'Existing quick','manual',50,null,0,1) returning id",[owner])).rows[0].id;
  const oldSource=(await a.query('select public.mobile_read_quick_options() d')).rows[0].d.saved.rows.find(r=>r.id===oldSaved);
  const oldIntent={date:today,source:{kind:'saved',id:oldSaved,version:oldSource.version},quantities:null,operation:'register',idempotencyKey:'pre-expand'};
  const beforeExpand=(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify(oldIntent)])).rows[0];
  await admin.query(await file('20261004015101_mobile_personal_foods.sql'));
  await check('EXPAND keeps confirmed M4.2-1 intents replayable without normalization drift',async()=>{
    const after=(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify(oldIntent)])).rows[0];assert.equal(after.replayed,true);assert.deepEqual(after.response_body,beforeExpand.response_body);
  });
  const ts=await import('typescript');
  const localized=ts.transpileModule(await readFile(new URL('../../src/lib/localized-decimal.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  const source=ts.transpileModule(await readFile(new URL('../../src/lib/nutrition/food-quantity.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace('"../localized-decimal"',JSON.stringify('data:text/javascript;base64,'+Buffer.from(localized).toString('base64')));
  const {scaleFoodNutrition}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const fields={name:'Café personal',description:'Etiqueta',servingQuantity:0.125,servingUnit:'unidad',calories:22.5,proteinG:null,carbsG:1.11,fatG:0,sourceNote:'Mi fuente'};
  const mutate=async(i,c=a)=>(await c.query('select * from public.mobile_mutate_food($1::jsonb)',[JSON.stringify(i)])).rows[0];
  const create=(fields,key)=>({operation:'create',id:null,expectedVersion:null,fields,idempotencyKey:key});
  const read=async(id=null,c=a)=>(await c.query('select public.mobile_read_foods($1) d',[id])).rows[0].d;
  const edit=async(id,operation,key,fields=null)=>({operation,id,expectedVersion:(await read(id))[0].version,fields,idempotencyKey:key});
  const selection=async(id,quantity)=>( {date:today,source:{kind:'food',id,version:(await read(id))[0].version},quantities:[{itemId:id,quantity}]} );
  const preview=async(s,c=a)=>(await c.query('select * from public.mobile_preview_quick_meal($1::jsonb)',[JSON.stringify(s)])).rows[0];
  const confirm=async(s,key,c=a)=>(await c.query('select * from public.mobile_confirm_quick_meal($1::jsonb)',[JSON.stringify({...s,operation:'register',idempotencyKey:key})])).rows[0];
  let food;
  await check('personal create preserves null/zero/decimal base, normalized replay and private ownership',async()=>{
    const i=create(fields,'create'); const r=await mutate(i);assert.equal(r.response_status,201);food=r.response_body.id;
    const f=(await read(food))[0];assert.equal(f.name,'CAFÉ PERSONAL');assert.equal(f.calories,22.5);assert.equal(f.serving_quantity,0.125);assert.equal(f.protein_g,null);assert.equal(f.fat_g,0);
    assert.equal((await mutate({...i,fields:{...fields,name:'  café   personal  '}})).replayed,true);
    assert.equal((await mutate({...i,fields:{...fields,calories:23}})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    assert.deepEqual(await read(null,stranger),[]);assert.equal((await mutate(await edit(food,'delete','foreign'),stranger)).response_body.error,'FOOD_UNAVAILABLE');
    await assert.rejects(a.query('select * from public.mobile_idempotency_keys'),e=>e.code==='42501');
  });
  await check('canonical quantity uses 3 decimals, preview is read-only and matches actual Web calculator',async()=>{
    const f=(await read(food))[0];let checks=0;
    for(const quantity of [0.001,0.125,0.126,0.375,1,1.125,1000.125]){
      const s=await selection(food,quantity),p=await preview(s);let expected;
      try{expected=scaleFoodNutrition(f,quantity);}catch{assert.equal(p.response_body.error,'QUICK_SOURCE_UNUSABLE');continue;}
      assert.equal(p.response_status,200);
      for(const k of ['calories','proteinG','carbsG','fatG'])assert.equal(p.response_body.snapshot[k],expected[k]);checks++;
    }
    assert.ok(checks>=5);
    const p=await preview({...await selection(food,0.125),date:'1900-01-01'});assert.equal(p.response_status,200);assert.match(p.response_body.snapshot.description,/0,125 UNIDAD/);
    assert.equal((await admin.query("select count(*)::int n from public.day_logs where user_id=$1 and log_date='1900-01-01'",[owner])).rows[0].n,0);
    for(const quantity of [0,-1,0.0001,1.2345,1000001]) await assert.rejects(a.query('select * from public.mobile_preview_quick_meal($1)',[JSON.stringify({...await selection(food,1),quantities:[{itemId:food,quantity}]})]),e=>e.code==='22023');
  });
  let registered,registration;
  await check('Food confirms through the shared ledger and stores exact preview/provenance',async()=>{
    await a.query("update public.foods set precision_level='label' where id=$1",[food]);
    const s=await selection(food,0.375),p=await preview(s);registration=s;
    const r=await confirm(s,'register');registered=r.response_body.resourceId;assert.equal(r.response_status,201);
    const entry=(await admin.query('select * from public.meal_entries where id=$1',[registered])).rows[0];
    for(const [k,col] of [['calories','final_calories'],['proteinG','final_protein_g'],['carbsG','final_carbs_g'],['fatG','final_fat_g']])assert.equal(entry[col]===null?null:Number(entry[col]),p.response_body.snapshot[k]);
    assert.equal(entry.description,p.response_body.snapshot.description);assert.equal(entry.precision_level,'label');assert.equal(entry.context_type,'food_quantity');assert.equal(entry.source_note,fields.sourceNote);assert.equal(entry.source_type,'manual');
    assert.equal((await confirm(s,'register')).replayed,true);assert.equal((await confirm({...s,date:yesterday},'register')).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    assert.equal((await confirm(s,'foreign-registration',stranger)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
  });
  await check('Food historical registration uses only the explicitly selected date',async()=>{
    const selectionBefore=await selection(food,0.125);selectionBefore.date='1900-01-01';
    const r=await confirm(selectionBefore,'historical-food');assert.equal(r.response_status,201);
    const actual=(await admin.query('select d.log_date::text dt from public.meal_entries m join public.day_logs d on d.id=m.day_log_id where m.id=$1',[r.response_body.resourceId])).rows[0];assert.equal(actual.dt,'1900-01-01');
  });
  await check('catalog CAS occurs under a transactional lock; concurrent Web edit is not overwritten',async()=>{
    const i=await edit(food,'update','stale',{...fields,calories:100});
    await b.query('begin');await b.query('update public.foods set calories=77 where id=$1',[food]);
    const pending=mutate(i);await new Promise(r=>setTimeout(r,30));await b.query('commit');
    assert.equal((await pending).response_body.error,'FOOD_CHANGED');assert.equal((await read(food))[0].calories,77);
    const good=await edit(food,'update','update',{...fields,calories:25.75});const r=await mutate(good);assert.equal(r.response_status,201);assert.equal((await read(food))[0].calories,25.75);assert.equal((await read(food))[0].precision_level,'label');
    assert.equal((await mutate(good)).replayed,true);assert.equal((await confirm(registration,'changed-source')).response_body.error,'QUICK_SOURCE_CHANGED');
  });
  await check('archive/reactivate and active name conflicts preserve definition and historical truth',async()=>{
    const before=(await admin.query('select to_jsonb(m) d from public.meal_entries m where id=$1',[registered])).rows[0].d;
    const stale=await edit(food,'archive','archive'),s=await selection(food,1);assert.equal((await mutate(stale)).response_status,201);assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
    assert.equal((await mutate(stale)).replayed,true);const duplicate=await mutate(create({...fields,name:'café personal'},'active-duplicate'));assert.equal(duplicate.response_status,201);
    assert.equal((await mutate(await edit(food,'reactivate','name-conflict'))).response_body.error,'FOOD_NAME_EXISTS');
    await mutate(await edit(duplicate.response_body.id,'delete','delete-duplicate'));assert.equal((await mutate(await edit(food,'reactivate','reactivate'))).response_status,201);
    assert.equal((await read(food))[0].is_active,true);assert.deepEqual((await admin.query('select to_jsonb(m) d from public.meal_entries m where id=$1',[registered])).rows[0].d,before);
  });
  await check('delete is Web hard catalog delete; snapshots, components and receipts stay independent',async()=>{
    const saved=(await a.query("insert into public.saved_meals(user_id,name,template_type) values($1,'With provenance','composite') returning id",[owner])).rows[0].id;
    const item=(await a.query("insert into public.saved_meal_items(user_id,saved_meal_id,label,quantity,unit,base_quantity,base_calories,source_food_id,position) values($1,$2,'Snapshot',1,'u',1,25,$3,0) returning id",[owner,saved,food])).rows[0].id;
    const before=(await admin.query('select to_jsonb(i) d from public.saved_meal_items i where id=$1',[item])).rows[0].d;
    const s=await selection(food,1),i=await edit(food,'delete','delete');assert.equal((await mutate(i)).response_status,201);assert.deepEqual(await read(food),[]);assert.equal((await mutate(i)).replayed,true);
    assert.equal((await confirm(registration,'register')).replayed,true);assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
    assert.deepEqual((await admin.query('select to_jsonb(i) d from public.saved_meal_items i where id=$1',[item])).rows[0].d,before);
    assert.ok((await admin.query('select id from public.meal_entries where id=$1',[registered])).rows.length===1);
    assert.equal((await mutate(create(fields,'create'))).replayed,true);
  });
  await check('invalid nutritional data cannot create facts; zero/null definitions cannot register',async()=>{
    for(const patch of [{servingQuantity:0},{servingQuantity:1.2345},{calories:-1},{calories:1.234},{proteinG:1000000},{calories:null,proteinG:null,carbsG:null,fatG:null}])await assert.rejects(a.query('select * from public.mobile_mutate_food($1)',[JSON.stringify(create({...fields,...patch},'invalid'))]),e=>e.code==='22023');
    for(const calories of [null,0]){const r=await mutate(create({...fields,name:'Unknown '+calories,calories},'unknown'+calories));const p=await preview(await selection(r.response_body.id,1));assert.equal(p.response_body.error,'QUICK_SOURCE_UNUSABLE');}
    const r=await mutate(create({...fields,name:'Tiny',servingQuantity:1000,calories:0.01},'tiny'));assert.equal((await preview(await selection(r.response_body.id,0.001))).response_body.error,'QUICK_SOURCE_UNUSABLE');
  });
  await check('concurrent same intent inserts one definition; source edit race conflicts at confirm',async()=>{
    const i=create({...fields,name:'Once'},'concurrent'),[r1,r2]=await Promise.all([mutate(i),mutate(i,b)]);assert.equal(r1.response_body.id,r2.response_body.id);assert.equal([r1,r2].filter(r=>r.replayed).length,1);
    const s=await selection(r1.response_body.id,1);await b.query('begin');await b.query("update public.foods set description='Web' where id=$1",[r1.response_body.id]);
    const pending=confirm(s,'source-race');await new Promise(r=>setTimeout(r,30));await b.query('commit');assert.equal((await pending).response_body.error,'QUICK_SOURCE_CHANGED');
  });
  console.log(`PostgreSQL: ${checks} groups PASS`);
} finally {await Promise.allSettled(clients.map(c=>c.end()));if(started)await pg.stop();await rm(directory,{recursive:true,force:true});}
