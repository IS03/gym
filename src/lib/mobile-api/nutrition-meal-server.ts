import 'server-only';
import { NextResponse } from 'next/server';
import { MobileApiUnauthorizedError, MobileApiValidationError, mobileBearerToken } from './auth';
import { authenticateMobileMutationAccessToken } from './supabase';
import { mobileApiResponseHeaders, readMobileJson } from './http';
import { parseMealMutationIntent, parseMealMutationResponse, type MealMutationIntent } from './nutrition-meal-contract';

export async function nutritionMealMutationResponse(request: Request, operation: MealMutationIntent['operation'], date: string, id: string | null = null) {
  let status = 503;
  let body: unknown = { error: 'DATA_UNAVAILABLE' };
  try {
    const context = await authenticateMobileMutationAccessToken(mobileBearerToken(request.headers.get('authorization')));
    const intent = parseMealMutationIntent(await readMobileJson(request));
    if (!intent || intent.operation !== operation || intent.sourceDate !== date || intent.mealId !== id) {
      throw new MobileApiValidationError('Revisá los datos de la comida.');
    }
    const { data, error } = await context.supabase.rpc('mobile_mutate_manual_meal', { p_intent: intent });
    if (error) {
      if (['22023','22007','22008','22P02','22003'].includes(error.code)) throw new MobileApiValidationError('Revisá los datos de la comida.');
      throw new Error('Meal mutation unavailable');
    }
    const receipt = Array.isArray(data) && data.length === 1 ? data[0] : null;
    const parsed = parseMealMutationResponse(receipt?.response_body);
    if (receipt?.response_status === 404 && receipt.response_body?.error === 'NOT_FOUND') {
      status = 404; body = { error: 'NOT_FOUND', message: 'La comida no está disponible.' };
    } else if (parsed && [200,201,409].includes(receipt.response_status)
      && (receipt.response_status === 409 ? 'error' in parsed : 'status' in parsed)) {
      status = receipt.response_status; body = parsed;
    } else throw new Error('Invalid meal mutation receipt');
  } catch (error) {
    if (error instanceof MobileApiUnauthorizedError) { status = 401; body = { error: 'UNAUTHORIZED' }; }
    else if (error instanceof MobileApiValidationError) { status = 400; body = { error: 'VALIDATION_ERROR', message: error.message }; }
    else console.warn('[mobile.nutrition.meal] mutation unavailable');
  }
  return NextResponse.json(body, { status, headers: mobileApiResponseHeaders(request) });
}
