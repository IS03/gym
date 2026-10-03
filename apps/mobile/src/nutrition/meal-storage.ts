import { NutritionIntentRepository, type NutritionStoragePort } from './intent-repository';
import { parseMealMutationIntent, parseMealMutationResponse, type MealMutationIntent, type MealMutationReceipt } from '@/api/nutrition-meal';
import { isMealDraft, type MealDraft } from './meal-form-model';
export type MealStoragePort = NutritionStoragePort;
export type StoredMealIntent = { version: 1; intent: MealMutationIntent; draft: MealDraft; receipt?: MealMutationReceipt };
function parseStored(value: unknown): StoredMealIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid stored meal intent');
  const v = value as Record<string, unknown>;
  const intent = parseMealMutationIntent(v.intent), receipt = v.receipt ? parseMealMutationResponse(v.receipt) : undefined;
  if (v.version !== 1 || !intent || !isMealDraft(v.draft) || (v.receipt && (!receipt || !('status' in receipt)))) throw new Error('Invalid stored meal intent');
  if (receipt && 'status' in receipt && (receipt.sourceDate !== intent.sourceDate
      || receipt.destinationDate !== (intent.fields?.date ?? intent.sourceDate) || (intent.mealId && receipt.mealId !== intent.mealId)
      || receipt.status !== (intent.operation === 'delete' ? 'deleted' : 'saved'))) throw new Error('Mismatched stored meal receipt');
  return { version: 1, intent, draft: v.draft, ...(receipt && 'status' in receipt ? { receipt } : {}) };
}
export class MealIntentRepository extends NutritionIntentRepository<StoredMealIntent> {
  constructor(port: MealStoragePort, userId: string) { super(port, `ownlevel.nutrition.meal.v1.${encodeURIComponent(userId)}`, parseStored); }
}
