import type { MobileApiClient } from './client';
import { parseMealMutationResponse, type MealMutationIntent } from '../../../../src/lib/mobile-api/nutrition-meal-contract';
export { parseManualMealFields, parseMealMutationIntent, parseMealMutationResponse } from '../../../../src/lib/mobile-api/nutrition-meal-contract';
export type { ManualMealFields, MealMutationIntent, MealMutationReceipt, MealMutationResponse } from '../../../../src/lib/mobile-api/nutrition-meal-contract';
export function mutateManualMeal(client: MobileApiClient, intent: MealMutationIntent, signal?: AbortSignal) {
  return client.request({ method: intent.operation === 'create' ? 'POST' : intent.operation === 'edit' ? 'PATCH' : 'DELETE',
    path: `/api/mobile/v1/nutrition/days/${intent.sourceDate}/meals${intent.mealId ? `/${intent.mealId}` : ''}`,
    body: intent, signal, parse: value => {
      const result = parseMealMutationResponse(value);
      if (!result || 'error' in result) return result;
      return result.sourceDate === intent.sourceDate && result.destinationDate === (intent.fields?.date ?? intent.sourceDate)
        && (!intent.mealId || result.mealId === intent.mealId) && result.status === (intent.operation === 'delete' ? 'deleted' : 'saved') ? result : undefined;
    } });
}
