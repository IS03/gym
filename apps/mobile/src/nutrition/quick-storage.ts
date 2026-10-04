import { NutritionIntentRepository, type NutritionStoragePort } from './intent-repository';
import { parseQuickIntent, parseQuickResponse, sameQuickSelection, type QuickIntent, type QuickReceipt } from '@/api/nutrition-quick';
import { parseQuickDraft, selectionFromDraft, type QuickDraft } from './quick-model';
export type StoredQuickIntent = { version: 1; intent: QuickIntent; draft: QuickDraft; receipt?: QuickReceipt };
function parseStored(value: unknown): StoredQuickIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid quick intent');
  const v = value as Record<string, unknown>, intent = parseQuickIntent(v.intent), draft = parseQuickDraft(v.draft);
  const receipt = v.receipt ? parseQuickResponse(v.receipt) : undefined;
  if (v.version !== 1 || !intent || !draft || !selectionFromDraft(draft).selection
    || !sameQuickSelection(intent, selectionFromDraft(draft).selection!)
    || v.receipt && (!receipt || 'error' in receipt || receipt.operation !== intent.operation || receipt.date !== intent.date)) throw new Error('Invalid quick intent');
  return { version: 1, intent, draft, ...(receipt && !('error' in receipt) ? { receipt } : {}) };
}
export class QuickIntentRepository extends NutritionIntentRepository<StoredQuickIntent> {
  constructor(port: NutritionStoragePort, userId: string) { super(port, `ownlevel.nutrition.quick.v1.${encodeURIComponent(userId)}`, parseStored); }
}
