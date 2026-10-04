import {
  BODY_MEASUREMENT_FIELDS, bodyRecord, parseBodyMeasurement, parseBodyMeasurementIntent, parseBodyMeasurementReceipt,
  parseBodyWeightIntent, parseBodyWeightReceipt, isBodyWeight,
  type BodyMeasurement, type BodyMeasurementIntent, type BodyMeasurementReceipt, type BodyWeightIntent, type BodyWeightReceipt,
} from '@/api/body';
import { NutritionIntentRepository, type NutritionStoragePort } from '@/nutrition/intent-repository';
import type { MeasurementDraft, WeightDraft } from './body-model';

// One durable Body intent at a time, persisted BEFORE sending. No offline queue,
// no automatic transmission: recovery replays the same key only on request.
export type WeightEditor = { kind: 'weight'; mode: 'create' | 'edit'; baseline: number | null; draft: WeightDraft };
export type MeasurementEditor = { kind: 'measurement'; mode: 'create' | 'edit'; baseline: BodyMeasurement | null; draft: MeasurementDraft };
export type BodyEditor = WeightEditor | MeasurementEditor;
export type StoredBodyIntent =
  | { version: 1; kind: 'weight'; intent: BodyWeightIntent; editor: WeightEditor; receipt?: BodyWeightReceipt }
  | { version: 1; kind: 'measurement'; intent: BodyMeasurementIntent; editor: MeasurementEditor; receipt?: BodyMeasurementReceipt };

const strings = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => typeof v[k] === 'string');
function parseEditor(v: unknown): BodyEditor | undefined {
  if (!bodyRecord(v) || (v.mode !== 'create' && v.mode !== 'edit') || !bodyRecord(v.draft)) return;
  if (v.kind === 'weight') {
    if (!strings(v.draft, ['date', 'weight']) || (v.baseline !== null && !isBodyWeight(v.baseline))) return;
    return { kind: 'weight', mode: v.mode, baseline: v.baseline as number | null, draft: v.draft as WeightDraft };
  }
  if (v.kind !== 'measurement' || !strings(v.draft, ['date', ...BODY_MEASUREMENT_FIELDS, 'condition', 'notes'])) return;
  const baseline = v.baseline === null ? null : parseBodyMeasurement(v.baseline);
  if (baseline === undefined || (v.mode === 'edit') !== (baseline !== null)) return;
  return { kind: 'measurement', mode: v.mode, baseline, draft: v.draft as MeasurementDraft };
}
export function parseStoredBodyIntent(v: unknown): StoredBodyIntent {
  if (!bodyRecord(v) || v.version !== 1) throw new Error('Invalid body intent');
  const editor = parseEditor(v.editor);
  if (v.kind === 'weight' && editor?.kind === 'weight') {
    const intent = parseBodyWeightIntent(v.intent), receipt = v.receipt === undefined ? undefined : parseBodyWeightReceipt(v.receipt);
    if (intent && (v.receipt === undefined || (receipt && receipt.operation === intent.operation && receipt.date === intent.date))) {
      return { version: 1, kind: 'weight', intent, editor, ...(receipt ? { receipt } : {}) };
    }
  }
  if (v.kind === 'measurement' && editor?.kind === 'measurement') {
    const intent = parseBodyMeasurementIntent(v.intent), receipt = v.receipt === undefined ? undefined : parseBodyMeasurementReceipt(v.receipt);
    if (intent && (v.receipt === undefined || (receipt && receipt.operation === intent.operation))) {
      return { version: 1, kind: 'measurement', intent, editor, ...(receipt ? { receipt } : {}) };
    }
  }
  throw new Error('Invalid body intent');
}
export class BodyIntentRepository extends NutritionIntentRepository<StoredBodyIntent> {
  constructor(port: NutritionStoragePort, userId: string) {
    super(port, `ownlevel.body.intent.v1.${encodeURIComponent(userId)}`, parseStoredBodyIntent);
  }
}
