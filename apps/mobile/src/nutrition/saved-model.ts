import {parseSavedFields,parsePersonalSavedMeal,type PersonalSavedMeal,type SavedFields,type SavedIngredient,type SavedItem} from '@/api/nutrition-saved';
import {parsePersonalFood,type PersonalFood} from '@/api/nutrition-food';
import {scaleSavedNutrients,sumSavedNutrients} from '../../../../src/lib/mobile-api/saved-meal-math';
export type SavedDraftItem={food:PersonalFood|null;snapshot:SavedItem|null;quantity:string};
export type SavedDraft={name:string;description:string;templateType:'manual'|'composite';calories:string;proteinG:string;carbsG:string;fatG:string;items:SavedDraftItem[]};
export const savedLabels={name:'Nombre',description:'Descripción',calories:'Calorías',proteinG:'Proteína (g)',carbsG:'Carbohidratos (g)',fatG:'Grasas (g)'};
const text=(v:number|null|undefined)=>v==null?'':String(v).replace('.',',');
export function savedDraft(meal?:PersonalSavedMeal|null,type:SavedDraft['templateType']='manual'):SavedDraft{return {name:meal?.name??'',description:meal?.description??'',templateType:meal?.templateType??type,calories:text(meal?.calories),proteinG:text(meal?.proteinG),carbsG:text(meal?.carbsG),fatG:text(meal?.fatG),items:meal?.items.map(snapshot=>({snapshot,food:null,quantity:text(snapshot.quantity)}))??[]};}
export const draftFoodId=(i:SavedDraftItem)=>i.food?.id??i.snapshot?.sourceFoodId;
export const ingredientLabel=(i:SavedDraftItem)=>i.food?.name??i.snapshot!.label;
export const ingredientUnit=(i:SavedDraftItem)=>i.food?.servingUnit??i.snapshot!.unit;
export function ingredientBase(i:SavedDraftItem){return i.snapshot??{baseQuantity:i.food!.servingQuantity,baseCalories:i.food!.calories,baseProteinG:i.food!.proteinG,baseCarbsG:i.food!.carbsG,baseFatG:i.food!.fatG};}
export function savedNumber(value:string,digits=2):number|null|undefined {const v=value.trim();if(!v)return null;if(!(digits===0?/^\d+$/:new RegExp(`^\\d+(?:[,.]\\d{1,${digits}})?$`)).test(v))return undefined;return Number(v.replace(',','.'));}
export function validateSavedDraft(d:SavedDraft):{fields?:SavedFields;errors:Record<string,string>} {
 const errors:Record<string,string>={};if(!d.name.trim())errors.name='Completá el nombre.';
 const nutrients=Object.fromEntries((['calories','proteinG','carbsG','fatG'] as const).map(k=>{const n=savedNumber(d[k],k==='calories'?0:2);if(n===undefined||n!==null&&(n<0||n>(k==='calories'?2147483647:99999999.99)))errors[k]='Ingresá un valor válido.';return [k,n];}));
 const items:SavedIngredient[]=[];
 if(d.templateType==='composite'){
  if(d.items.length<1||d.items.length>50)errors.items='Agregá entre 1 y 50 ingredientes.';
  const ids=d.items.map(draftFoodId).filter(Boolean);if(new Set(ids).size!==ids.length)errors.items='No repitas el mismo alimento.';
  d.items.forEach((i,index)=>{const n=savedNumber(i.quantity);if(n==null||n<=0||n>1000000){errors[`quantity:${index}`]='Cantidad mayor a 0, con hasta 2 decimales.';return;}
   items.push(i.food?{kind:'food',id:i.food.id,version:i.food.version,quantity:n}:{kind:'snapshot',id:i.snapshot!.id,quantity:n});});
 }
 const fields=parseSavedFields({name:d.name,description:d.description.trim()||null,templateType:d.templateType,
  ...(d.templateType==='manual'?nutrients:{calories:null,proteinG:null,carbsG:null,fatG:null}),items});
 if(!fields&&!Object.keys(errors).length)errors.calories='Informá al menos un nutriente válido.';
 return {fields:Object.keys(errors).length?undefined:fields,errors};
}
export function draftTotals(d:SavedDraft){if(d.templateType==='manual')return null;
 const scaled=d.items.map(i=>{const q=savedNumber(i.quantity);return q!=null&&q>0&&q<=1000000?scaleSavedNutrients(ingredientBase(i),q):null;});
 return scaled.some(n=>!n)?null:sumSavedNutrients(scaled as ReturnType<typeof scaleSavedNutrients>[]);
}
export function parseSavedDraft(v:unknown):SavedDraft|undefined {
 if(!v||typeof v!=='object'||Array.isArray(v))return;const d=v as SavedDraft;
 if(Object.keys(d).length!==8||!['manual','composite'].includes(d.templateType)||!Object.keys(savedLabels).every(k=>typeof d[k as keyof typeof savedLabels]==='string')||!Array.isArray(d.items)||d.items.length>50)return;
 for(const i of d.items){if(!i||typeof i!=='object'||Object.keys(i).length!==3||typeof i.quantity!=='string'||(i.food===null)===(i.snapshot===null))return;
  if(i.food&&!parsePersonalFood(i.food))return;
  if(i.snapshot&&!parsePersonalSavedMeal({id:i.snapshot.id,version:'a'.repeat(64),name:'Snapshot',description:null,templateType:'composite',calories:null,proteinG:null,carbsG:null,fatG:null,isActive:true,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',items:[{...i.snapshot,position:0}]}))return;
 }
 return d;
}
