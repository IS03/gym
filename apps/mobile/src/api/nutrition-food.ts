import type { MobileApiClient } from './client';
import { parseFoodDetail, parseFoodsResponse, parseFoodReceipt, type FoodFilter, type FoodIntent, type PersonalFood } from '../../../../src/lib/mobile-api/nutrition-food-contract';
import type { QuickOption } from './nutrition-quick';
export * from '../../../../src/lib/mobile-api/nutrition-food-contract';
export function fetchFoods(client:MobileApiClient,filter:FoodFilter='active',q='',signal?:AbortSignal) {
  return client.read({path:`/api/mobile/v1/nutrition/foods?filter=${filter}&q=${encodeURIComponent(q)}`,signal,parse:parseFoodsResponse});
}
export function fetchFood(client:MobileApiClient,id:string,signal?:AbortSignal) {
  return client.read({path:`/api/mobile/v1/nutrition/foods/${id}`,signal,parse:v=>{const d=parseFoodDetail(v);return d&&(!d.food||d.food.id===id)?d:undefined;}});
}
export function mutateFood(client:MobileApiClient,intent:FoodIntent,signal?:AbortSignal) {
  return client.request({method:intent.operation==='create'?'POST':intent.operation==='delete'?'DELETE':'PATCH',
    path:intent.operation==='create'?'/api/mobile/v1/nutrition/foods':`/api/mobile/v1/nutrition/foods/${intent.id}`,body:intent,signal,
    parse:v=>{const r=parseFoodReceipt(v);return r && r.operation===intent.operation && (!intent.id||r.id===intent.id)?r:undefined;}});
}
export function foodQuickOption(food:PersonalFood):QuickOption {
  return { source:{kind:'food',id:food.id,version:food.version},name:food.name,description:food.description,
    calories:food.calories,proteinG:food.proteinG,carbsG:food.carbsG,fatG:food.fatG,templateType:null,useCount:null,lastUsedDate:null,
    items:[{id:food.id,label:food.name,quantity:food.servingQuantity,unit:food.servingUnit}] };
}
