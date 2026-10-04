import type {PersonalSavedMeal,SavedReceipt} from '@/api/nutrition-saved';
export const savedId='42300000-0000-4000-8000-000000000001';
export const personalSaved:PersonalSavedMeal={id:savedId,name:'CAFÉ',description:null,templateType:'manual',calories:null,proteinG:0,carbsG:null,fatG:1.25,items:[],version:'a'.repeat(64),isActive:true,createdAt:'2026-10-04T00:00:00Z',updatedAt:'2026-10-04T00:00:00Z'};
export const savedReceipt:SavedReceipt={status:'confirmed',operation:'create',id:savedId,version:personalSaved.version,updatedAt:personalSaved.updatedAt};
