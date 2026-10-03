import type { NutritionDayMeal } from '../../../../src/lib/mobile-api/nutrition-day-contract';
import { parseManualMealFields, type ManualMealFields } from '@/api/nutrition-meal';
import { inputNutritionDate, parseInputNutritionDate } from './day-format';
export type MealDraft = { date: string; title: string; description: string; calories: string; proteinG: string; carbsG: string; fatG: string };
export function mealDraft(date: string, meal?: NutritionDayMeal | null): MealDraft {
  const number = (n: number | null | undefined) => n == null ? '' : String(n).replace('.', ',');
  return { date: inputNutritionDate(date), title: meal?.title ?? '', description: meal?.description ?? '', calories: number(meal?.calories),
    proteinG: number(meal?.proteinG), carbsG: number(meal?.carbsG), fatG: number(meal?.fatG) };
}
export function validateMealDraft(draft: MealDraft): { fields?: ManualMealFields; errors: Partial<Record<keyof MealDraft, string>> } {
  const errors: Partial<Record<keyof MealDraft, string>> = {};
  const date = parseInputNutritionDate(draft.date);
  if (!date) errors.date = 'Ingresá una fecha válida (DD/MM/AAAA).';
  const number = (key: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => {
    const text = draft[key].trim();
    if (!text && key !== 'calories') return null;
    if (!/^\d+(?:[,.]\d{1,2})?$/.test(text)) { errors[key] = 'Ingresá un número válido, con hasta dos decimales.'; return null; }
    const value = Number(text.replace(',', '.'));
    if (key === 'calories' ? !Number.isInteger(value) || value <= 0 || value > 2147483647 : value > (key === 'proteinG' ? 999999.99 : 99999999.99)) {
      errors[key] = key === 'calories' ? 'Las calorías deben ser enteras y mayores a 0.' : 'El valor supera el límite permitido.';
    }
    return value;
  };
  const fields = parseManualMealFields({ date, title: draft.title, description: draft.description, calories: number('calories'),
    proteinG: number('proteinG'), carbsG: number('carbsG'), fatG: number('fatG') });
  return { fields: Object.keys(errors).length ? undefined : fields, errors };
}
export function isMealDraft(value: unknown): value is MealDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 7 && ['date','title','description','calories','proteinG','carbsG','fatG'].every(k => typeof v[k] === 'string');
}
