import { parseMealMutationIntent, parseMealMutationResponse, type MealMutationIntent, type MealMutationReceipt } from '@/api/nutrition-meal';
import { isMealDraft, type MealDraft } from './meal-form-model';
export type MealStoragePort = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
export type StoredMealIntent = { version: 1; intent: MealMutationIntent; draft: MealDraft; receipt?: MealMutationReceipt };
const queues = new WeakMap<MealStoragePort, Map<string, Promise<unknown>>>();
export class MealIntentRepository {
  readonly key: string;
  private readonly queue: Map<string, Promise<unknown>>;
  constructor(private port: MealStoragePort, userId: string) {
    this.key = `ownlevel.nutrition.meal.v1.${encodeURIComponent(userId)}`;
    this.queue = queues.get(port) ?? new Map(); queues.set(port, this.queue);
  }
  private serialize<T>(run: () => Promise<T>): Promise<T> {
    const job = (this.queue.get(this.key) ?? Promise.resolve()).catch(() => undefined).then(run);
    this.queue.set(this.key, job);
    void job.finally(() => { if (this.queue.get(this.key) === job) this.queue.delete(this.key); }).catch(() => undefined);
    return job;
  }
  read() { return this.serialize(async (): Promise<StoredMealIntent | null> => {
    const raw = await this.port.getItem(this.key);
    if (raw === null) return null;
    const v = JSON.parse(raw);
    const intent = parseMealMutationIntent(v.intent), receipt = v.receipt ? parseMealMutationResponse(v.receipt) : undefined;
    if (v.version !== 1 || !intent || !isMealDraft(v.draft) || (v.receipt && (!receipt || !('status' in receipt)))) throw new Error('Invalid stored meal intent');
    if (receipt && 'status' in receipt && (receipt.sourceDate !== intent.sourceDate
      || receipt.destinationDate !== (intent.fields?.date ?? intent.sourceDate) || (intent.mealId && receipt.mealId !== intent.mealId)
      || receipt.status !== (intent.operation === 'delete' ? 'deleted' : 'saved'))) throw new Error('Mismatched stored meal receipt');
    return { version: 1, intent, draft: v.draft, ...(receipt && 'status' in receipt ? { receipt } : {}) };
  }); }
  write(record: StoredMealIntent) { return this.serialize(async () => {
    const previous = await this.port.getItem(this.key);
    if (previous && JSON.parse(previous).intent?.idempotencyKey !== record.intent.idempotencyKey) throw new Error('Another pending meal intent');
    await this.port.setItem(this.key, JSON.stringify(record));
  }); }
  clear(idempotencyKey: string) { return this.serialize(async () => {
    const previous = await this.port.getItem(this.key);
    if (previous && JSON.parse(previous).intent?.idempotencyKey === idempotencyKey) await this.port.removeItem(this.key);
  }); }
}
