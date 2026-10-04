import { mealUuid, mealVersion } from './nutrition-meal-contract';
export type FoodFilter = 'active' | 'archived' | 'all';
export type FoodFields = { name: string; description: string | null; servingQuantity: number; servingUnit: string;
  calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; sourceNote: string | null };
export type PersonalFood = FoodFields & { id: string; version: string; precisionLevel: 'catalog' | 'label' | 'estimated' | 'historical' | null;
  isActive: boolean; createdAt: string; updatedAt: string };
export type FoodsResponse = { status: 'ok'; foods: PersonalFood[] };
export type FoodDetail = { status: 'ok'; food: PersonalFood | null };
export type FoodOperation = 'create' | 'update' | 'archive' | 'reactivate' | 'delete';
export type FoodIntent = { operation: FoodOperation; id: string | null; expectedVersion: string | null; fields: FoodFields | null; idempotencyKey: string };
export type FoodReceipt = { status: 'confirmed'; operation: FoodOperation; id: string; version: string | null; updatedAt: string | null };
export type FoodConflict = { error: 'FOOD_CHANGED' | 'FOOD_UNAVAILABLE' | 'FOOD_NAME_EXISTS' | 'IDEMPOTENCY_KEY_REUSED'; message: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const foodVersion = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string | null => v === null || typeof v === 'string';
export function foodDecimal(v: unknown, digits = 2, max = 999999.99): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max && Number(v.toFixed(digits)) === v;
}
export function parseFoodFields(v: unknown): FoodFields | undefined {
  if (!record(v) || Object.keys(v).length !== 9 || typeof v.name !== 'string' || !v.name.trim() || typeof v.servingUnit !== 'string'
    || !v.servingUnit.trim() || ![v.description,v.sourceNote].every(text) || !foodDecimal(v.servingQuantity,3,1000000) || v.servingQuantity < 0.001
    || !(v.calories === null || foodDecimal(v.calories,2,99999999.99)) || ![v.proteinG,v.carbsG,v.fatG].every(n => n === null || foodDecimal(n))
    || [v.calories,v.proteinG,v.carbsG,v.fatG].every(n => n === null)) return undefined;
  // Normalize exactly the persisted food name/unit and Web's optional text.
  return { name: v.name.trim().replace(/\s+/g,' ').toUpperCase(), description: (v.description as string | null)?.trim() || null,
    servingQuantity: v.servingQuantity, servingUnit: v.servingUnit.trim(), calories: v.calories as number | null,
    proteinG: v.proteinG as number | null, carbsG: v.carbsG as number | null, fatG: v.fatG as number | null, sourceNote: (v.sourceNote as string | null)?.trim() || null };
}
export function parsePersonalFood(v: unknown): PersonalFood | undefined {
  if (!record(v) || !mealUuid(v.id) || !foodVersion(v.version) || typeof v.isActive !== 'boolean' || !mealVersion(v.createdAt) || !mealVersion(v.updatedAt)
    || ![null,'catalog','label','estimated','historical'].includes(v.precisionLevel as string | null)) return undefined;
  const fields = parseFoodFields(Object.fromEntries(['name','description','servingQuantity','servingUnit','calories','proteinG','carbsG','fatG','sourceNote'].map(k => [k,v[k]])));
  return fields ? { ...fields, id: v.id.toLowerCase(), version: v.version, isActive: v.isActive, createdAt: v.createdAt, updatedAt: v.updatedAt,
    precisionLevel: v.precisionLevel as PersonalFood['precisionLevel'] } : undefined;
}
export function parseFoodsResponse(v: unknown): FoodsResponse | undefined {
  if (!record(v) || v.status !== 'ok' || !Array.isArray(v.foods)) return undefined;
  const foods = v.foods.map(parsePersonalFood);
  return foods.every(f => f) && new Set(foods.map(f => f!.id)).size === foods.length ? { status: 'ok', foods: foods as PersonalFood[] } : undefined;
}
export function parseFoodDetail(v: unknown): FoodDetail | undefined {
  if (!record(v) || v.status !== 'ok') return undefined;
  const food = v.food === null ? null : parsePersonalFood(v.food);
  return food === undefined ? undefined : { status: 'ok', food };
}
export function parseFoodIntent(v: unknown): FoodIntent | undefined {
  if (!record(v) || Object.keys(v).length !== 5 || !['create','update','archive','reactivate','delete'].includes(String(v.operation))
    || typeof v.idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(v.idempotencyKey)) return undefined;
  const create = v.operation === 'create', edit = v.operation === 'update', fields = create || edit ? parseFoodFields(v.fields) : null;
  if ((create ? v.id !== null || v.expectedVersion !== null : !mealUuid(v.id) || !foodVersion(v.expectedVersion))
    || (create || edit ? !fields : v.fields !== null)) return undefined;
  return { operation: v.operation as FoodOperation, id: create ? null : String(v.id).toLowerCase(), expectedVersion: v.expectedVersion as string | null,
    fields: fields ?? null, idempotencyKey: v.idempotencyKey };
}
export function parseFoodReceipt(v: unknown): FoodReceipt | undefined {
  if (!record(v) || v.status !== 'confirmed' || !mealUuid(v.id) || !['create','update','archive','reactivate','delete'].includes(String(v.operation))
    || (v.operation === 'delete' ? v.version !== null || v.updatedAt !== null : !foodVersion(v.version) || !mealVersion(v.updatedAt))) return undefined;
  return { status: 'confirmed', operation: v.operation as FoodOperation, id: v.id.toLowerCase(), version: v.version as string | null, updatedAt: v.updatedAt as string | null };
}
export function parseFoodConflict(v: unknown): FoodConflict | undefined {
  return record(v) && typeof v.message === 'string' && ['FOOD_CHANGED','FOOD_UNAVAILABLE','FOOD_NAME_EXISTS','IDEMPOTENCY_KEY_REUSED'].includes(String(v.error))
    ? { error: v.error as FoodConflict['error'], message: v.message } : undefined;
}
