import { isNutritionDate } from './nutrition-day-contract';
import type { NutritionPlanEditor, EnergyConfigEditor } from '../nutrition/configuration-core';
export type ConfigOperation = 'plan' | 'energy' | 'physical';
export type PlanFields = { name: string; baseWaterL: number; trainingCalorieDeltaKcal: number; trainingWaterDeltaL: number; weekdays: {weekday: number; calorieTargetKcal: number; proteinTargetG: number}[] };
export type EnergyFields = { activityLevel: 'low'|'moderate'|'high'; baseExpenditureMode: 'automatic'|'custom'; customBaseExpenditureKcal: number|null; trainingExpenditureDeltaKcal: number };
export type PhysicalFields = { birthDate: string|null; sex: 'male'|'female'|'other'|null; heightCm: number|null; weightKg: number|null };
export type PhysicalConfig = PhysicalFields & { version: string; exists: boolean; bmrKcal: number|null; latestWeightDate: string|null; hasWeightHistory: boolean };
export type PlanConfig = NutritionPlanEditor & { version: string };
export type EnergyConfig = EnergyConfigEditor & { version: string; bmrKcal: number|null; automaticBaseKcal: number|null; usedBaseKcal: number|null };
export type ConfigSection<T> = { status:'ok'; data:T } | {status:'unavailable'};
export type NutritionConfig = {today:string; plan:ConfigSection<PlanConfig>; energy:ConfigSection<EnergyConfig>; physical:ConfigSection<PhysicalConfig>};
export type ConfigIntent = { date:string; expectedVersion:string; idempotencyKey:string } & (
 {operation:'plan';fields:PlanFields}|{operation:'energy';fields:EnergyFields}|{operation:'physical';fields:PhysicalFields});
export type ConfigReceipt = {status:'confirmed';operation:ConfigOperation;date:string;version:string;weightRecorded:boolean};
export const configRecord = (v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const configVersion = (v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).length===names.length&&names.every(n=>n in v);
const num=(v:unknown,min:number,max:number,decimals=2):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&Math.abs(v*10**decimals-Math.round(v*10**decimals))<1e-7;
const nullable=(v:unknown,min:number,max:number,d=2)=>v===null||num(v,min,max,d);
export function parseConfigFields(op:ConfigOperation,v:unknown): PlanFields|EnergyFields|PhysicalFields|undefined {
 if(!configRecord(v))return;
 if(op==='plan'){
  if(!keys(v,['name','baseWaterL','trainingCalorieDeltaKcal','trainingWaterDeltaL','weekdays'])||typeof v.name!=='string'||!v.name.trim()||!num(v.baseWaterL,0,50)||!num(v.trainingCalorieDeltaKcal,0,5000,0)||!num(v.trainingWaterDeltaL,0,20)||!Array.isArray(v.weekdays)||v.weekdays.length!==7)return;
  const days=v.weekdays;
  if(days.some(w=>!configRecord(w)||!keys(w,['weekday','calorieTargetKcal','proteinTargetG'])||!num(w.weekday,1,7,0)||!num(w.calorieTargetKcal,1,20000,0)||!num(w.proteinTargetG,0,2000))||new Set(days.map(w=>w.weekday)).size!==7)return;
  return {...v,name:v.name.trim(),weekdays:[...days].sort((a,b)=>a.weekday-b.weekday)} as PlanFields;
 }
 if(op==='energy'){
  if(!keys(v,['activityLevel','baseExpenditureMode','customBaseExpenditureKcal','trainingExpenditureDeltaKcal'])||!['low','moderate','high'].includes(String(v.activityLevel))||!['automatic','custom'].includes(String(v.baseExpenditureMode))||!num(v.trainingExpenditureDeltaKcal,0,5000,0)||(v.baseExpenditureMode==='automatic'?v.customBaseExpenditureKcal!==null:!num(v.customBaseExpenditureKcal,1,20000,0)))return;
  return v as EnergyFields;
 }
 if(!keys(v,['birthDate','sex','heightCm','weightKg'])||(v.birthDate!==null&&!isNutritionDate(v.birthDate))||(v.sex!==null&&!['male','female','other'].includes(String(v.sex)))||!nullable(v.heightCm,50,250,0)||!nullable(v.weightKg,0,999.99))return;
 return v as PhysicalFields;
}
export function parseConfigIntent(v:unknown):ConfigIntent|undefined {
 if(!configRecord(v)||!keys(v,['operation','date','expectedVersion','fields','idempotencyKey'])||!['plan','energy','physical'].includes(String(v.operation))||!isNutritionDate(v.date)||!configVersion(v.expectedVersion)||typeof v.idempotencyKey!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(v.idempotencyKey))return;
 const fields=parseConfigFields(v.operation as ConfigOperation,v.fields);return fields?{...v,fields} as ConfigIntent:undefined;
}
export function parseConfigReceipt(v:unknown):ConfigReceipt|undefined {
 return configRecord(v)&&v.status==='confirmed'&&['plan','energy','physical'].includes(String(v.operation))&&isNutritionDate(v.date)&&configVersion(v.version)&&typeof v.weightRecorded==='boolean'?v as ConfigReceipt:undefined;
}
export function parseNutritionConfig(v:unknown):NutritionConfig|undefined {
 if(!configRecord(v)||!isNutritionDate(v.today))return;
 const section=(raw:unknown,op:ConfigOperation):boolean=>{
  if(!configRecord(raw))return false;if(raw.status==='unavailable')return true;
  if(raw.status!=='ok'||!configRecord(raw.data)||!configVersion(raw.data.version))return false;
  const d=raw.data;
  if(op==='physical')return !!parseConfigFields('physical',{birthDate:d.birthDate,sex:d.sex,heightCm:d.heightCm,weightKg:d.weightKg})&&typeof d.exists==='boolean'&&nullable(d.bmrKcal,0,2147483647,0)&&(d.latestWeightDate===null||isNutritionDate(d.latestWeightDate))&&typeof d.hasWeightHistory==='boolean'&&d.hasWeightHistory===(d.latestWeightDate!==null);
  if(!['v2','legacy','default'].includes(String(d.source))||(d.id!==null&&typeof d.id!=='string')||(d.effectiveFrom!==null&&!isNutritionDate(d.effectiveFrom)))return false;
  if(op==='energy')return !!parseConfigFields('energy',{activityLevel:d.activityLevel,baseExpenditureMode:d.baseExpenditureMode,customBaseExpenditureKcal:d.customBaseExpenditureKcal,trainingExpenditureDeltaKcal:d.trainingExpenditureDeltaKcal})&&[d.bmrKcal,d.automaticBaseKcal,d.usedBaseKcal].every(n=>nullable(n,0,2147483647,0));
  return typeof d.name==='string'&&nullable(d.baseWaterL,0,50)&&num(d.trainingCalorieDeltaKcal,0,5000,0)&&num(d.trainingWaterDeltaL,0,20)&&Array.isArray(d.weekdays)&&d.weekdays.length===7&&new Set(d.weekdays.map(w=>configRecord(w)?w.weekday:null)).size===7&&d.weekdays.every(w=>configRecord(w)&&num(w.weekday,1,7,0)&&nullable(w.calorieTargetKcal,1,20000,0)&&nullable(w.proteinTargetG,0,2000));
 };
 return section(v.plan,'plan')&&section(v.energy,'energy')&&section(v.physical,'physical')?v as NutritionConfig:undefined;
}
