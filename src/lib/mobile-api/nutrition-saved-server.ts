import 'server-only';
import { NextResponse } from 'next/server';
import { authenticateMobileMutationAccessToken } from './supabase';
import { mobileBearerToken, MobileApiUnauthorizedError, MobileApiValidationError } from './auth';
import { readMobileJson, mobileApiResponseHeaders } from './http';
import { mealUuid } from './nutrition-meal-contract';
import { parsePersonalSavedMeal, parseSavedIntent, parseSavedReceipt, parseSavedConflict } from './nutrition-saved-contract';
import { filterSavedMealCatalog } from '@/lib/nutrition/saved-meal-core';
export function mobileSavedMeal(raw:Record<string,unknown>) {
 const items=Array.isArray(raw.items)?raw.items.map(i=>({id:i.id,label:i.label,quantity:i.quantity,unit:i.unit,baseQuantity:i.base_quantity,
  baseCalories:i.base_calories,baseProteinG:i.base_protein_g,baseCarbsG:i.base_carbs_g,baseFatG:i.base_fat_g,sourceFoodId:i.source_food_id,position:i.position})):null;
 return parsePersonalSavedMeal({id:raw.id,name:raw.name,description:raw.description,templateType:raw.template_type,calories:raw.calories,
  proteinG:raw.protein_g,carbsG:raw.carbs_g,fatG:raw.fat_g,isActive:raw.is_active,version:raw.version,createdAt:raw.created_at,updatedAt:raw.updated_at,items});
}
export async function nutritionSavedResponse(request:Request,mode:'list'|'detail'|'write',id?:string) {
 let status=503,body:unknown={error:'DATA_UNAVAILABLE'};
 try {
  const auth=await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get('authorization')));
  if(id!==undefined&&!mealUuid(id))throw new MobileApiValidationError('Comida guardada inválida.');id=id?.toLowerCase();
  if(mode!=='write'){
   const params=new URL(request.url).searchParams,filter=params.get('filter')??'active',q=params.get('q')??'';
   if(!['active','archived','all'].includes(filter)||q.length>200||[...params.keys()].some(k=>!['filter','q'].includes(k)))throw new MobileApiValidationError('Filtro inválido.');
   const {data,error}=await auth.supabase.rpc('mobile_read_saved_meals',mode==='detail'?{p_id:id}:{},{get:true});
   if(error||!Array.isArray(data))throw new Error('Saved unavailable');const meals=data.map(mobileSavedMeal);
   if(meals.some(m=>!m)||new Set(meals.map(m=>m!.id)).size!==meals.length)throw new Error('Invalid saved data');
   if(mode==='detail'){if(meals.length>1||meals[0]&&meals[0].id!==id)throw new Error('Invalid detail');body={status:'ok',meal:meals[0]??null};}
   else {const ids=new Set(filterSavedMealCatalog(data,filter as 'active'|'archived'|'all',q).map(m=>m.id));body={status:'ok',meals:meals.filter(m=>ids.has(m!.id))};}status=200;
  } else {
   const intent=parseSavedIntent(await readMobileJson(request));
   if(!intent||intent.id!==(id??null)||(request.method==='POST'?intent.operation!=='create':request.method==='DELETE'?intent.operation!=='delete':!['update','archive','reactivate'].includes(intent.operation)))throw new MobileApiValidationError('Revisá la plantilla.');
   const {data,error}=await auth.supabase.rpc('mobile_mutate_saved_meal',{p_intent:intent});
   if(error){if(['22023','22P02','22003','23514'].includes(error.code))throw new MobileApiValidationError('Revisá nutrientes e ingredientes.');throw new Error('Saved write unavailable');}
   const row=Array.isArray(data)&&data.length===1?data[0]:null;
   if(row?.response_status===409){const c=parseSavedConflict(row.response_body);if(!c)throw new Error('Invalid conflict');status=409;body=c;}
   else if(row?.response_status===201){const r=parseSavedReceipt(row.response_body);if(!r||r.operation!==intent.operation||intent.id&&r.id!==intent.id)throw new Error('Invalid receipt');status=201;body=r;}
   else throw new Error('Invalid receipt');
  }
 }catch(error){if(error instanceof MobileApiUnauthorizedError){status=401;body={error:'UNAUTHORIZED'};}
  else if(error instanceof MobileApiValidationError){status=400;body={error:'VALIDATION_ERROR',message:error.message};}
  else console.warn('[mobile.nutrition.saved] unavailable');}
 return NextResponse.json(body,{status,headers:mobileApiResponseHeaders(request)});
}
