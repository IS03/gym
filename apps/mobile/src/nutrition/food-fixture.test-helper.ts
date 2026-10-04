import type { PersonalFood,FoodReceipt } from '@/api/nutrition-food';
export const foodId='42200000-0000-4000-8000-000000000001';
export const personalFood:PersonalFood={id:foodId,name:'CAFÉ',description:'Etiqueta',servingQuantity:0.125,servingUnit:'unidad',calories:22.5,proteinG:null,carbsG:1.11,fatG:0,sourceNote:'Fuente',
 version:'a'.repeat(64),precisionLevel:'label',isActive:true,createdAt:'2026-10-03T12:00:00Z',updatedAt:'2026-10-03T12:00:00.123456Z'};
export const foodReceipt:FoodReceipt={status:'confirmed',operation:'create',id:foodId,version:personalFood.version,updatedAt:personalFood.updatedAt};
