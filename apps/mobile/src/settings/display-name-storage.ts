import {
  parseDisplayNameIntent, parseDisplayNameReceipt, parseProfileIdentity,
  type DisplayNameIntent, type DisplayNameReceipt, type ProfileIdentity,
} from '@/api/profile-identity';
import { NutritionIntentRepository, type NutritionStoragePort } from '@/nutrition/intent-repository';

// One durable display-name intent per user, persisted BEFORE sending. No queue,
// no automatic transmission: recovery replays the same key only on request.
export type StoredDisplayNameIntent = { version: 1; intent: DisplayNameIntent; baseline: ProfileIdentity; draft: string; receipt?: DisplayNameReceipt };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parseStoredDisplayNameIntent(v: unknown): StoredDisplayNameIntent {
  if (!record(v) || v.version !== 1 || typeof v.draft !== 'string') throw new Error('Invalid display name intent');
  const intent = parseDisplayNameIntent(v.intent), baseline = parseProfileIdentity(v.baseline);
  const receipt = v.receipt === undefined ? undefined : parseDisplayNameReceipt(v.receipt);
  if (!intent || !baseline || intent.expectedVersion !== baseline.version || (v.receipt !== undefined && !receipt)) throw new Error('Invalid display name intent');
  return { version: 1, intent, baseline, draft: v.draft, ...(receipt ? { receipt } : {}) };
}
export class DisplayNameIntentRepository extends NutritionIntentRepository<StoredDisplayNameIntent> {
  constructor(port: NutritionStoragePort, userId: string) {
    super(port, `ownlevel.profile.display-name.v1.${encodeURIComponent(userId)}`, parseStoredDisplayNameIntent);
  }
}
