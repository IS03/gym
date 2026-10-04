import { jest } from '@jest/globals';
import type { BodyMeasurement, BodyOverview, BodyWeightEntry } from '@/api/body';
import type { MobileApiResultMeta } from '@/api/results';
import type { BodyApi } from './body-controller';
import { BodyIntentRepository } from './body-storage';

export const TODAY = '2026-10-04';
export const MID = '51000000-0000-4000-8000-000000000001';
export const meta: MobileApiResultMeta = { durationMs: 1, httpStatus: 200, outcome: 'ok' };
export const ok = <T,>(data: T) => ({ status: 'ok' as const, data, meta });
export const lost = { status: 'unavailable' as const, reason: 'network' as const, meta: { ...meta, httpStatus: null, outcome: 'unavailable' as const } };
export const conflict = (code: 'WEIGHT_CHANGED' | 'MEASUREMENT_CHANGED' | 'MEASUREMENT_DATE_TAKEN' | 'BODY_FUTURE_DATE', message = 'cambió') =>
  ({ status: 'conflict' as const, code, message, meta: { ...meta, httpStatus: 409, outcome: 'conflict' as const } });
export function measurement(patch: Partial<BodyMeasurement> = {}): BodyMeasurement {
  return { id: MID, measuredOn: '2026-10-01', waistCm: 80, abdomenCm: null, chestCm: null, hipCm: null, armRightCm: null, armLeftCm: null,
    thighRightCm: null, thighLeftCm: null, calfRightCm: null, calfLeftCm: null, armCm: null, thighCm: null, condition: null, notes: null,
    imported: false, importSource: null, qualityStatus: 'verified', qualityNote: null, updatedAt: '2026-10-01T12:00:00.123456+00:00', ...patch };
}
export function overview(patch: Partial<BodyOverview> = {}, weights: BodyWeightEntry[] = [{ date: TODAY, weightKg: 80.5 }, { date: '2026-10-02', weightKg: 81 }]): BodyOverview {
  return { today: TODAY, current: weights[0] ?? null, profileWeightKg: weights[0]?.weightKg ?? null,
    weights: { items: weights, nextBefore: null }, measurements: { items: [measurement()], nextBefore: null }, ...patch };
}
export function memoryStorage() {
  const store = new Map<string, string>();
  return { store, port: { getItem: async (k: string) => store.get(k) ?? null, setItem: async (k: string, v: string) => { store.set(k, v); }, removeItem: async (k: string) => { store.delete(k); } } };
}
export function fakeApi(data: BodyOverview = overview()) {
  return {
    overview: jest.fn<BodyApi['overview']>().mockResolvedValue(ok(data)),
    weights: jest.fn<BodyApi['weights']>().mockResolvedValue(ok({ today: TODAY, items: [], nextBefore: null })),
    measurements: jest.fn<BodyApi['measurements']>().mockResolvedValue(ok({ today: TODAY, items: [], nextBefore: null })),
    weight: jest.fn<BodyApi['weight']>(),
    measurement: jest.fn<BodyApi['measurement']>(),
  };
}
export const repository = (port: ReturnType<typeof memoryStorage>['port']) => new BodyIntentRepository(port, 'owner');
