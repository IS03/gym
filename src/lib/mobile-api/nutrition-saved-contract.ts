import { mealUuid, mealVersion } from './nutrition-meal-contract';
import { foodDecimal, foodVersion, type FoodOperation } from './nutrition-food-contract';
export type SavedItem = { id:string; label:string; quantity:number; unit:string; baseQuantity:number; baseCalories:number|null;
  baseProteinG:number|null; baseCarbsG:number|null; baseFatG:number|null; sourceFoodId:string|null; position:number };
export type SavedIngredient = { kind:'snapshot'; id:string; quantity:number } | { kind:'food'; id:string; version:string; quantity:number };
export type SavedFields = { name:string; description:string|null; templateType:'manual'|'composite'; calories:number|null;
  proteinG:number|null; carbsG:number|null; fatG:number|null; items:SavedIngredient[] };
export type PersonalSavedMeal = Omit<SavedFields,'items'> & { id:string; version:string; isActive:boolean; createdAt:string; updatedAt:string; items:SavedItem[] };
export type SavedIntent = { operation:FoodOperation; id:string|null; expectedVersion:string|null; fields:SavedFields|null; idempotencyKey:string };
export type SavedReceipt = { status:'confirmed'; operation:FoodOperation; id:string; version:string|null; updatedAt:string|null };
export type SavedList = { status:'ok'; meals:PersonalSavedMeal[] };
export type SavedDetail = { status:'ok'; meal:PersonalSavedMeal|null };
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const optional=(v:unknown,max=99999999.99,digits=2):v is number|null=>v===null||foodDecimal(v,digits,max);
export function parseSavedFields(v:unknown):SavedFields|undefined {
 if(!record(v)||Object.keys(v).length!==8||typeof v.name!=='string'||!v.name.trim()||!(v.description===null||typeof v.description==='string')
  ||!['manual','composite'].includes(String(v.templateType))||!Array.isArray(v.items))return;
 const items:SavedIngredient[]=[];
 for(const i of v.items){if(!record(i)||!mealUuid(i.id)||!foodDecimal(i.quantity,2,1000000)||i.quantity<=0
  ||(i.kind==='food'?Object.keys(i).length!==4||!foodVersion(i.version):i.kind!=='snapshot'||Object.keys(i).length!==3))return;
  items.push(i.kind==='food'?{kind:'food',id:i.id.toLowerCase(),version:i.version as string,quantity:i.quantity}:{kind:'snapshot',id:i.id.toLowerCase(),quantity:i.quantity});}
 if(new Set(items.map(i=>i.kind+':'+i.id)).size!==items.length)return;
 if(v.templateType==='manual'?(items.length!==0||!optional(v.calories,2147483647,0)||![v.proteinG,v.carbsG,v.fatG].every(n=>optional(n))
  ||[v.calories,v.proteinG,v.carbsG,v.fatG].every(n=>n===null)):(items.length<1||items.length>50||![v.calories,v.proteinG,v.carbsG,v.fatG].every(n=>n===null)))return;
 const text=(t:string)=>t.trim().replace(/\s+/g,' ');
 return {name:text(v.name).toUpperCase(),description:v.description===null?null:text(v.description)||null,templateType:v.templateType as SavedFields['templateType'],
  calories:v.calories as number|null,proteinG:v.proteinG as number|null,carbsG:v.carbsG as number|null,fatG:v.fatG as number|null,items};
}
export function parsePersonalSavedMeal(v:unknown):PersonalSavedMeal|undefined {
 if(!record(v)||!mealUuid(v.id)||!foodVersion(v.version)||typeof v.name!=='string'||!v.name.trim()||!(v.description===null||typeof v.description==='string')
  ||!['manual','composite'].includes(String(v.templateType))||typeof v.isActive!=='boolean'||!mealVersion(v.createdAt)||!mealVersion(v.updatedAt)
  ||!optional(v.calories,2147483647,0)||![v.proteinG,v.carbsG,v.fatG].every(n=>optional(n))||!Array.isArray(v.items))return;
 const items:SavedItem[]=[];
 for(const i of v.items){if(!record(i)||!mealUuid(i.id)||typeof i.label!=='string'||!i.label.trim()||typeof i.unit!=='string'||!i.unit.trim()
  ||!foodDecimal(i.quantity,3,1000000)||i.quantity<=0||!foodDecimal(i.baseQuantity,3,1000000)||i.baseQuantity<=0
  ||!optional(i.baseCalories,99999999.99)||![i.baseProteinG,i.baseCarbsG,i.baseFatG].every(n=>optional(n,99999999.9999,4))
  ||!(i.sourceFoodId===null||mealUuid(i.sourceFoodId))||i.position!==items.length)return;
  items.push(i as SavedItem);}
 if(new Set(items.map(i=>i.id)).size!==items.length|| (v.templateType==='manual'?items.length!==0:items.length<1||items.length>50))return;
 return {id:v.id.toLowerCase(),version:v.version,name:v.name,description:v.description,templateType:v.templateType as SavedFields['templateType'],isActive:v.isActive,
  createdAt:v.createdAt,updatedAt:v.updatedAt,calories:v.calories as number|null,proteinG:v.proteinG as number|null,carbsG:v.carbsG as number|null,fatG:v.fatG as number|null,items};
}
export function parseSavedList(v:unknown):SavedList|undefined {
 if(!record(v)||v.status!=='ok'||!Array.isArray(v.meals))return;const meals=v.meals.map(parsePersonalSavedMeal);
 return meals.every(m=>m)&&new Set(meals.map(m=>m!.id)).size===meals.length?{status:'ok',meals:meals as PersonalSavedMeal[]}:undefined;
}
export function parseSavedDetail(v:unknown):SavedDetail|undefined {
 if(!record(v)||v.status!=='ok')return;const meal=v.meal===null?null:parsePersonalSavedMeal(v.meal);return meal===undefined?undefined:{status:'ok',meal};
}
export function parseSavedIntent(v:unknown):SavedIntent|undefined {
 if(!record(v)||Object.keys(v).length!==5||!['create','update','archive','reactivate','delete'].includes(String(v.operation))
  ||typeof v.idempotencyKey!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(v.idempotencyKey))return;
 const create=v.operation==='create',edit=v.operation==='update',fields=create||edit?parseSavedFields(v.fields):null;
 if((create?v.id!==null||v.expectedVersion!==null:!mealUuid(v.id)||!foodVersion(v.expectedVersion))||(create||edit?!fields:v.fields!==null)
  ||create&&fields?.items.some(i=>i.kind==='snapshot'))return;
 return {operation:v.operation as FoodOperation,id:create?null:String(v.id).toLowerCase(),expectedVersion:v.expectedVersion as string|null,fields:fields??null,idempotencyKey:v.idempotencyKey};
}
export function parseSavedReceipt(v:unknown):SavedReceipt|undefined {
 if(!record(v)||v.status!=='confirmed'||!mealUuid(v.id)||!['create','update','archive','reactivate','delete'].includes(String(v.operation))
  ||(v.operation==='delete'?v.version!==null||v.updatedAt!==null:!foodVersion(v.version)||!mealVersion(v.updatedAt)))return;
 return v as SavedReceipt;
}
export function parseSavedConflict(v:unknown):{error:string;message:string}|undefined {
 return record(v)&&typeof v.message==='string'&&['SAVED_CHANGED','SAVED_UNAVAILABLE','SAVED_NAME_EXISTS','SAVED_FOOD_CHANGED','SAVED_FOOD_UNAVAILABLE','IDEMPOTENCY_KEY_REUSED'].includes(String(v.error))?{error:String(v.error),message:v.message}:undefined;
}
