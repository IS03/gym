import 'server-only';
import { NextResponse } from 'next/server';
import { planEditor, energyEditor } from '@/lib/nutrition/configuration-core';
import { estimateBaseExpenditure } from '@/lib/nutrition/plan-v2-core';
import type { NutritionPlanPeriod, NutritionPlanWeekday, NutritionGoalPeriod, EnergyConfigPeriod, ExpenditureRulePeriod } from '@/lib/phase1/types';
import { authenticateMobileMutationAccessToken } from './supabase';
import { mobileBearerToken, MobileApiUnauthorizedError, MobileApiValidationError } from './auth';
import { readMobileJson, mobileApiResponseHeaders } from './http';
import { configRecord as record, parseNutritionConfig, parseConfigIntent, parseConfigReceipt, type NutritionConfig, type ConfigOperation, type ConfigSection } from './nutrition-config-contract';
export function configurationDto(raw:unknown):NutritionConfig|undefined {
 if(!record(raw))return;
 const map=(section:unknown,op:ConfigOperation):ConfigSection<unknown>=>{
  if(!record(section)||section.status!=='ok'||!record(section.data))return {status:'unavailable'};
  const d=section.data,profile=record(d.profile)?d.profile:null;
  try {
   if(op==='plan')return {status:'ok',data:{...planEditor(d.parent?{...d.parent as NutritionPlanPeriod,nutrition_plan_weekdays:d.weekdays as NutritionPlanWeekday[]}:null,d.legacy as NutritionGoalPeriod|null),version:d.version}};
   if(op==='energy'){
    const energy=energyEditor(d.parent as EnergyConfigPeriod|null,d.legacy as ExpenditureRulePeriod|null),bmr=profile?.bmr_kcal_current??null;
    const automaticBaseKcal=typeof bmr==='number'?estimateBaseExpenditure(bmr,energy.activityLevel):null;
    return {status:'ok',data:{...energy,version:d.version,bmrKcal:bmr,automaticBaseKcal,usedBaseKcal:bmr===null?null:energy.baseExpenditureMode==='custom'?energy.customBaseExpenditureKcal:automaticBaseKcal}};
   }
   const latest=record(d.latestWeight)?d.latestWeight:null;
   return {status:'ok',data:{exists:profile!==null,version:d.version,birthDate:profile?.birth_date??null,sex:profile?.sex??null,heightCm:profile?.height_cm??null,weightKg:profile?.current_weight_kg??null,bmrKcal:profile?.bmr_kcal_current??null,hasWeightHistory:latest!==null,latestWeightDate:latest?.date??null}};
  }catch{return {status:'unavailable'};}
 };
 return parseNutritionConfig({today:raw.today,plan:map(raw.plan,'plan'),energy:map(raw.energy,'energy'),physical:map(raw.physical,'physical')});
}
export async function nutritionConfigurationResponse(request:Request,physicalOnly=false) {
 let status=503,body:unknown={error:'DATA_UNAVAILABLE'};
 try {
  const auth=await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get('authorization')));
  if(request.method==='GET'){
   const {data,error}=await auth.supabase.rpc('mobile_read_nutrition_configuration',{}, {get:true});
   const dto=error?undefined:configurationDto(data);if(!dto)throw new Error('Invalid configuration');
   body=physicalOnly?{today:dto.today,physical:dto.physical}:dto;status=200;
  }else{
   const intent=parseConfigIntent(await readMobileJson(request));
   if(!intent||(physicalOnly?intent.operation!=='physical':intent.operation==='physical'))throw new MobileApiValidationError('Revisá la configuración.');
   const {data,error}=await auth.supabase.rpc('mobile_mutate_nutrition_configuration',{p_intent:intent});
   if(error){if(['22023','22P02','22003','23514','22008','22007'].includes(error.code))throw new MobileApiValidationError('Revisá los valores de la configuración.');throw new Error('Write unavailable');}
   const row=Array.isArray(data)&&data.length===1?data[0]:null;
   if(row?.response_status===200){const receipt=parseConfigReceipt(row.response_body);if(!receipt||receipt.operation!==intent.operation||receipt.date!==intent.date)throw new Error('Invalid receipt');body=receipt;status=200;}
   else if(row?.response_status===409&&record(row.response_body)&&['CONFIG_CHANGED','PHYSICAL_CHANGED','CONFIG_DAY_CHANGED','ENERGY_PROFILE_REQUIRED','PHYSICAL_WEIGHT_REQUIRED','IDEMPOTENCY_KEY_REUSED'].includes(String(row.response_body.error))&&typeof row.response_body.message==='string'){body={error:row.response_body.error,message:row.response_body.message};status=409;}
   else throw new Error('Invalid write response');
  }
 }catch(e){if(e instanceof MobileApiUnauthorizedError){status=401;body={error:'UNAUTHORIZED'};}else if(e instanceof MobileApiValidationError){status=400;body={error:'VALIDATION_ERROR',message:e.message};}else console.warn('[mobile.nutrition.config] unavailable');}
 return NextResponse.json(body,{status,headers:mobileApiResponseHeaders(request)});
}
