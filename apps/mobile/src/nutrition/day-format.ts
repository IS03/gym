import { isNutritionDate, type NutritionNutrientTotal } from '@/api/nutrition-day';

export function nutritionToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftNutritionDate(date: string, offset: number): string | undefined {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  const value = result.toISOString().slice(0, 10);
  return isNutritionDate(value) ? value : undefined;
}
export function displayNutritionDate(date: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}
export function inputNutritionDate(date: string): string {
  return date.split('-').reverse().join('/');
}
export function parseInputNutritionDate(input: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
  if (!match) return undefined;
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  return isNutritionDate(date) ? date : undefined;
}
export const number = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
export function amount(value: number | null, unit: string): string {
  return value === null ? 'Sin dato' : `${number(value)}${unit ? ` ${unit}` : ''}`;
}
export function nutrientAmount(total: NutritionNutrientTotal, entries: number, unit: string): string {
  if (entries > 0 && total.missingCount === entries) return 'Sin dato';
  return `${number(total.knownTotal)} ${unit}${total.missingCount > 0 ? ' · parcial' : ''}`;
}
export function signedAmount(value: number | null): string {
  return value === null ? 'Sin dato' : `${value > 0 ? '+' : ''}${number(value)} kcal`;
}
