import type { MobileApiClient } from './client';
import { parseNutritionConfig,parseConfigReceipt,type ConfigIntent,configRecord } from '../../../../src/lib/mobile-api/nutrition-config-contract';
export * from '../../../../src/lib/mobile-api/nutrition-config-contract';
export const fetchNutritionConfig=(client:MobileApiClient,signal?:AbortSignal)=>client.read({path:'/api/mobile/v1/nutrition/config',signal,parse:parseNutritionConfig});
export const fetchPhysicalProfile=(client:MobileApiClient,signal?:AbortSignal)=>client.read({path:'/api/mobile/v1/profile/physical',signal,parse:(v:unknown)=>{
 if(!configRecord(v))return;const c=parseNutritionConfig({...v,plan:{status:'unavailable'},energy:{status:'unavailable'}});return c?{today:c.today,physical:c.physical}:undefined;
}});
export const mutateNutritionConfig=(client:MobileApiClient,intent:ConfigIntent,signal?:AbortSignal)=>client.request({method:'PATCH',path:intent.operation==='physical'?'/api/mobile/v1/profile/physical':'/api/mobile/v1/nutrition/config',body:intent,signal,parse:(v:unknown)=>{
 const r=parseConfigReceipt(v);return r&&r.operation===intent.operation&&r.date===intent.date?r:undefined;
}});
