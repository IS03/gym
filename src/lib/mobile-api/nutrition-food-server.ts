import 'server-only';
import { NextResponse } from 'next/server';
import { filterFoodCatalog } from '@/lib/nutrition/food-catalog-core';
import { parseFoodInput } from '@/lib/nutrition/product';
import type { Food } from '@/lib/phase1/types';
import { authenticateMobileMutationAccessToken } from './supabase';
import { mobileBearerToken, MobileApiUnauthorizedError, MobileApiValidationError } from './auth';
import { readMobileJson, mobileApiResponseHeaders } from './http';
import { mealUuid } from './nutrition-meal-contract';
import { parsePersonalFood, parseFoodIntent, parseFoodReceipt, parseFoodConflict, type FoodFilter, type PersonalFood } from './nutrition-food-contract';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function mobileFood(raw: unknown): PersonalFood | undefined {
  if (!record(raw)) return undefined;
  return parsePersonalFood({ id: raw.id, name: raw.name, description: raw.description, servingQuantity: raw.serving_quantity,
    servingUnit: raw.serving_unit, calories: raw.calories, proteinG: raw.protein_g, carbsG: raw.carbs_g, fatG: raw.fat_g,
    precisionLevel: raw.precision_level, sourceNote: raw.source_note, isActive: raw.is_active, createdAt: raw.created_at, updatedAt: raw.updated_at, version: raw.version });
}
export async function nutritionFoodResponse(request: Request, mode: 'list' | 'detail' | 'write', id?: string) {
  let status = 503; let body: unknown = { error: 'DATA_UNAVAILABLE' };
  try {
    const auth = await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get('authorization')));
    if (id !== undefined && !mealUuid(id)) throw new MobileApiValidationError('Alimento inválido.');
    id = id?.toLowerCase();
    if (mode !== 'write') {
      const params = new URL(request.url).searchParams, filter = params.get('filter') ?? 'active', q = params.get('q') ?? '';
      if (!['active','archived','all'].includes(filter) || q.length > 200 || [...params.keys()].some(k => !['filter','q'].includes(k))) throw new MobileApiValidationError('Filtro inválido.');
      const { data, error } = await auth.supabase.rpc('mobile_read_foods', { p_id: mode === 'detail' ? id : null }, { get: true });
      if (error || !Array.isArray(data)) throw new Error('Foods unavailable');
      const foods = data.map(mobileFood);
      if (foods.some(f => !f) || new Set(foods.map(f => f!.id)).size !== foods.length) throw new Error('Invalid food data');
      if (mode === 'detail') {
        if (foods.length > 1 || foods[0] && foods[0].id !== id) throw new Error('Invalid detail');
        body = { status: 'ok', food: foods[0] ?? null };
      } else {
        const visible = new Set(filterFoodCatalog(data as Food[], filter as FoodFilter, q).map(f => f.id));
        body = { status: 'ok', foods: foods.filter(f => visible.has(f!.id)) };
      }
      status = 200;
    } else {
      const intent = parseFoodIntent(await readMobileJson(request));
      if (!intent || intent.id !== (id ?? null) || (request.method === 'POST' ? intent.operation !== 'create'
        : request.method === 'DELETE' ? intent.operation !== 'delete' : !['update','archive','reactivate'].includes(intent.operation))) throw new MobileApiValidationError('Revisá los datos del alimento.');
      if (intent.fields) parseFoodInput({ ...intent.fields, description: intent.fields.description ?? '', sourceNote: intent.fields.sourceNote ?? '' });
      const { data, error } = await auth.supabase.rpc('mobile_mutate_food', { p_intent: intent });
      if (error) {
        if (['22023','22P02','22003','23514'].includes(error.code)) throw new MobileApiValidationError('Revisá los datos del alimento.');
        throw new Error('Food write unavailable');
      }
      const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
      if (row?.response_status === 409) {
        const conflict = parseFoodConflict(row.response_body); if (!conflict) throw new Error('Invalid conflict');
        status = 409; body = conflict;
      } else if (row?.response_status === 201) {
        const receipt = parseFoodReceipt(row.response_body);
        if (!receipt || receipt.operation !== intent.operation || intent.id && receipt.id !== intent.id) throw new Error('Invalid receipt');
        status = 201; body = receipt;
      } else throw new Error('Invalid response');
    }
  } catch (error) {
    if (error instanceof MobileApiUnauthorizedError) { status = 401; body = { error: 'UNAUTHORIZED' }; }
    else if (error instanceof MobileApiValidationError) { status = 400; body = { error: 'VALIDATION_ERROR', message: error.message }; }
    else console.warn('[mobile.nutrition.food] unavailable');
  }
  return NextResponse.json(body,{ status, headers: mobileApiResponseHeaders(request) });
}
