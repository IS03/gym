import { parseFoodFields, type PersonalFood, type FoodFields } from '@/api/nutrition-food';
export type FoodDraft = Record<keyof FoodFields,string>;
export const foodLabels:Record<keyof FoodFields,string>={ name:'Nombre',description:'Descripción',servingQuantity:'Cantidad base',servingUnit:'Unidad',calories:'Calorías',proteinG:'Proteína (g)',carbsG:'Carbohidratos (g)',fatG:'Grasas (g)',sourceNote:'Fuente' };
export const foodDraft=(food?:PersonalFood|null):FoodDraft=>({name:food?.name??'',description:food?.description??'',servingQuantity:String(food?.servingQuantity??1).replace('.',','),servingUnit:food?.servingUnit??'unidad',
  calories:food?.calories==null?'':String(food.calories).replace('.',','),proteinG:food?.proteinG==null?'':String(food.proteinG).replace('.',','),
  carbsG:food?.carbsG==null?'':String(food.carbsG).replace('.',','),fatG:food?.fatG==null?'':String(food.fatG).replace('.',','),sourceNote:food?.sourceNote??''});
export function validateFoodDraft(d:FoodDraft):{fields?:FoodFields;errors:Partial<Record<keyof FoodFields,string>>} {
  const errors:Partial<Record<keyof FoodFields,string>>={};
  for(const key of ['name','servingUnit'] as const) if(!d[key].trim()) errors[key]='Completá este campo.';
  const number=(key:'servingQuantity'|'calories'|'proteinG'|'carbsG'|'fatG')=>{
    const t=d[key].trim(),digits=key==='servingQuantity'?3:2;
    if(!t&&key!=='servingQuantity')return null;
    const n=new RegExp(`^\\d+(?:[,.]\\d{1,${digits}})?$`).test(t)?Number(t.replace(',','.')):NaN;
    const max=key==='servingQuantity'?1000000:key==='calories'?99999999.99:999999.99;
    if(!Number.isFinite(n)||n>(max)||n<(key==='servingQuantity'?0.001:0))errors[key]=`Ingresá un valor válido, con hasta ${digits} decimales.`;
    return n;
  };
  const raw={...d,description:d.description.trim()||null,sourceNote:d.sourceNote.trim()||null,servingQuantity:number('servingQuantity'),calories:number('calories'),proteinG:number('proteinG'),carbsG:number('carbsG'),fatG:number('fatG')};
  if([raw.calories,raw.proteinG,raw.carbsG,raw.fatG].every(n=>n===null))errors.calories='Informá al menos un valor nutricional.';
  const fields=parseFoodFields(raw);
  return {fields:Object.keys(errors).length?undefined:fields,errors};
}
export function parseFoodDraft(v:unknown):FoodDraft|undefined {
  if(!v||typeof v!=='object'||Array.isArray(v))return undefined;
  const d=v as Record<string,unknown>,keys=Object.keys(foodLabels);
  return Object.keys(d).length===keys.length&&keys.every(k=>typeof d[k]==='string')?d as FoodDraft:undefined;
}
