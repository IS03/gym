import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));vi.mock('./supabase',()=>({authenticateMobileMutationAccessToken:vi.fn()}));
import {authenticateMobileMutationAccessToken} from './supabase';
import {GET,PATCH,OPTIONS} from '@/app/api/mobile/v1/nutrition/config/route';
import {GET as profileGET,PATCH as profilePATCH} from '@/app/api/mobile/v1/profile/physical/route';
import {configurationDto} from './nutrition-config-server';
import {parseConfigIntent,parseConfigFields,parseNutritionConfig} from './nutrition-config-contract';
const version='a'.repeat(64),today='2026-10-04',rpc=vi.fn();
const fields={name:'Etapa',baseWaterL:0,trainingCalorieDeltaKcal:0,trainingWaterDeltaL:0,weekdays:Array.from({length:7},(_,i)=>({weekday:i+1,calorieTargetKcal:2000,proteinTargetG:0}))};
const intent={operation:'plan',date:today,fields,expectedVersion:version,idempotencyKey:'config:1'};
const source={today,version,parent:null,legacy:null,weekdays:[],profile:null,latestWeight:null};
const raw={today,plan:{status:'ok',data:source},energy:{status:'ok',data:source},physical:{status:'ok',data:source}};
const request=(method='GET',body?:unknown,token='Bearer token')=>new NextRequest('https://www.ownlevel.fit/api/mobile/v1/nutrition/config',{method,headers:{authorization:token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(authenticateMobileMutationAccessToken).mockResolvedValue({userId:'owner',supabase:{rpc}} as never);});
describe('Nutrition Configuration contract/API',()=>{
 it('defaults are absence, zero remains explicit and no product internals leak',async()=>{
  rpc.mockResolvedValue({data:raw,error:null});const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  const data=await response.json();expect(data.plan.data).toMatchObject({source:'default',id:null,baseWaterL:null});expect(data.plan.data.weekdays[0].calorieTargetKcal).toBeNull();expect(data.energy.data.bmrKcal).toBeNull();expect(data.physical.data).toMatchObject({exists:false,weightKg:null,hasWeightHistory:false});expect(rpc).toHaveBeenCalledWith('mobile_read_nutrition_configuration',{},{get:true});
  expect(parseConfigIntent(intent)).toBeDefined();expect(parseConfigIntent({...intent,user_id:'foreign'})).toBeUndefined();expect(parseConfigFields('plan',{...fields,baseWaterL:null})).toBeUndefined();
 });
 it('V2, legacy adaptation, BMR-dependent custom base and independent unavailability',()=>{
  const v2={...source,parent:{id:'plan',name:'V2',effective_from:today,base_water_l:2,training_calorie_delta_kcal:200,training_water_delta_l:0.5},weekdays:fields.weekdays.map(w=>({weekday:w.weekday,calorie_target_kcal:w.calorieTargetKcal,protein_target_g:w.proteinTargetG}))};
  const e={...source,parent:{id:'energy',effective_from:today,activity_level:'high',base_expenditure_mode:'custom',custom_base_expenditure_kcal:2600,training_expenditure_delta_kcal:300},profile:{bmr_kcal_current:1800}};
  const d=configurationDto({...raw,plan:{status:'ok',data:v2},energy:{status:'ok',data:e},physical:{status:'unavailable'}})!;
  expect(d.plan).toMatchObject({status:'ok',data:{source:'v2',baseWaterL:2}});expect(d.energy).toMatchObject({data:{automaticBaseKcal:2430,usedBaseKcal:2600}});expect(d.physical.status).toBe('unavailable');
  expect(configurationDto({...raw,energy:{status:'ok',data:{...e,profile:null}}})?.energy).toMatchObject({data:{usedBaseKcal:null}});
  const legacy={...source,legacy:{name:'Legacy',effective_from:'2026-01-01',calories_no_gym:1800,calories_gym:2100,protein_no_gym_g:90,water_no_gym_l:2,water_gym_l:2.5}};
  expect(configurationDto({...raw,plan:{status:'ok',data:legacy}})?.plan).toMatchObject({data:{source:'legacy',trainingCalorieDeltaKcal:300,trainingWaterDeltaL:0.5}});
  expect(parseNutritionConfig({...d,plan:{status:'ok',data:{}}})).toBeUndefined();
 });
 it('auth, strict fields, no client date override and shared profile routes',async()=>{
  expect((await GET(request('GET',undefined,''))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();
  expect((await PATCH(request('PATCH',{...intent,userId:'x'}))).status).toBe(400);
  expect((await PATCH(request('PATCH',{...intent,fields:{...fields,weekdays:fields.weekdays.slice(1)}}))).status).toBe(400);
  expect((await PATCH(request('PATCH',{...intent,operation:'physical',fields:{birthDate:null,sex:null,heightCm:null,weightKg:null}}))).status).toBe(400);
  rpc.mockResolvedValue({data:raw,error:null});expect(await (await profileGET(request())).json()).toMatchObject({today,physical:{status:'ok'}});
  expect((await OPTIONS(request())).status).toBe(204);
 });
 it.each(['plan','energy','physical'] as const)('%s calls one transactional RPC and validates receipt correlation',async operation=>{
  const f=operation==='plan'?fields:operation==='energy'?{activityLevel:'moderate',baseExpenditureMode:'automatic',customBaseExpenditureKcal:null,trainingExpenditureDeltaKcal:0}:{birthDate:'1990-01-01',sex:'male',heightCm:180,weightKg:0};
  const i={...intent,operation,fields:f},receipt={status:'confirmed',operation,date:today,version,weightRecorded:operation==='physical'};
  rpc.mockResolvedValueOnce({data:[{response_status:200,response_body:receipt,replayed:false}],error:null});const route=operation==='physical'?profilePATCH:PATCH;
  expect(await (await route(request('PATCH',i))).json()).toEqual(receipt);expect(rpc).toHaveBeenCalledWith('mobile_mutate_nutrition_configuration',{p_intent:i});
  rpc.mockResolvedValueOnce({data:[{response_status:200,response_body:{...receipt,date:'2026-10-03'}}],error:null});expect((await route(request('PATCH',i))).status).toBe(503);
 });
 it.each(['CONFIG_CHANGED','PHYSICAL_CHANGED','CONFIG_DAY_CHANGED','ENERGY_PROFILE_REQUIRED','PHYSICAL_WEIGHT_REQUIRED','IDEMPOTENCY_KEY_REUSED'])('explicit %s does not turn into empty/default',async error=>{
  rpc.mockResolvedValue({data:[{response_status:409,response_body:{error,message:'Revisá tus datos'}}],error:null});expect((await PATCH(request('PATCH',intent))).status).toBe(409);
 });
 it('RPC errors remain unavailable and validation is confirmed rejection',async()=>{
  rpc.mockResolvedValue({data:null,error:{code:'unavailable'}});expect((await GET(request())).status).toBe(503);expect((await PATCH(request('PATCH',intent))).status).toBe(503);
  rpc.mockResolvedValue({data:null,error:{code:'23514'}});expect((await PATCH(request('PATCH',intent))).status).toBe(400);
 });
});
