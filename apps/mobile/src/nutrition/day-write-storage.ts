import { parseDayWriteIntent, parseDayWriteResponse, type DayWriteIntent, type DayWriteReceipt } from '@/api/nutrition-day-write';
import { parseMobileNutritionDayResponse } from '@/api/nutrition-day';
import { NutritionIntentRepository, type NutritionStoragePort } from './intent-repository';
import { buildDayWriteIntent, type DayWriteDraft } from './day-write-model';
export type StoredDayWrite = { version: 1; intent: DayWriteIntent; draft: DayWriteDraft; receipt?: DayWriteReceipt };
function parseStored(value: unknown): StoredDayWrite {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid day intent');
  const v=value as Record<string,unknown>, intent=parseDayWriteIntent(v.intent);
  const draft=v.draft as DayWriteDraft | undefined;
  const baseline=parseMobileNutritionDayResponse(draft?.baseline);
  if (v.version!==1 || !intent || !draft || draft.kind!==intent.operation || !baseline || baseline.date!==intent.date
    || typeof draft.target!=='string' || typeof draft.expenditure!=='string' || !draft.metrics || typeof draft.metrics!=='object' || Array.isArray(draft.metrics)
    || Object.values(draft.metrics).some(m=>!m || typeof m!=='object' || typeof m.value!=='string' || typeof m.hours!=='string' || typeof m.minutes!=='string')) throw new Error('Invalid day draft');
  const normalizedDraft={...draft,baseline};
  const rebuilt=buildDayWriteIntent(normalizedDraft,intent.idempotencyKey).intent;
  if (!rebuilt || JSON.stringify(rebuilt)!==JSON.stringify(intent)) throw new Error('Stored intent/draft mismatch');
  const receipt=v.receipt ? parseDayWriteResponse(v.receipt) : undefined;
  if (v.receipt && (!receipt || !('status' in receipt) || receipt.operation!==intent.operation || receipt.date!==intent.date)) throw new Error('Invalid day receipt');
  return {version:1,intent,draft:{...draft,baseline},...(receipt && 'status' in receipt ? {receipt}: {})};
}
export class DayWriteRepository extends NutritionIntentRepository<StoredDayWrite> {
  constructor(port: NutritionStoragePort,userId: string) { super(port,`ownlevel.nutrition.day-write.v1.${encodeURIComponent(userId)}`,parseStored); }
}
