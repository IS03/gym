// Shared Web/Expo arithmetic; SQL mirrors this and is tested against it.
export type SavedNutrition={calories:number|null;proteinG:number|null;carbsG:number|null;fatG:number|null};
export type SavedBase={baseQuantity:number;baseCalories:number|null;baseProteinG:number|null;baseCarbsG:number|null;baseFatG:number|null};
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function scaleSavedNutrients(b:SavedBase,quantity:number):SavedNutrition {
 const factor=quantity/b.baseQuantity;
 const macro=(n:number|null)=>n===null?null:round(n*factor);
 return {calories:b.baseCalories===null?null:Math.round(b.baseCalories*factor),proteinG:macro(b.baseProteinG),carbsG:macro(b.baseCarbsG),fatG:macro(b.baseFatG)};
}
export function sumSavedNutrients(items:SavedNutrition[]):SavedNutrition {
 const sum=(key:keyof SavedNutrition)=>!items.length||items.some(i=>i[key]===null)?null:round(items.reduce((s,i)=>s+i[key]!,0));
 return {calories:sum('calories'),proteinG:sum('proteinG'),carbsG:sum('carbsG'),fatG:sum('fatG')};
}
