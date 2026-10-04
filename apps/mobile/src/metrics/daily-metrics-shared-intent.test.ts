import { describe, expect, it, jest } from '@jest/globals';
import { DayWriteController, type DayWriteApi } from '@/nutrition/day-write-controller';
import { DayWriteRepository } from '@/nutrition/day-write-storage';
import { canWriteDay } from '@/nutrition/day-write-model';
import { nutritionFixture } from '@/nutrition/day-fixture.test-helper';
import type { NutritionStoragePort } from '@/nutrition/intent-repository';

const date = '2026-10-02', meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const lost = { status: 'unavailable' as const, reason: 'network' as const, meta: { durationMs: 1, httpStatus: null, outcome: 'unavailable' as const } };
// Two surfaces (Nutrition + Daily Metrics) over ONE shared persisted intent per user.
function surfaces() {
  const map = new Map<string, string>();
  const port: NutritionStoragePort = { getItem: async k => map.get(k) ?? null, setItem: async (k, v) => { map.set(k, v); }, removeItem: async k => { map.delete(k); } };
  const api = {
    mutate: jest.fn<DayWriteApi['mutate']>().mockImplementation(async i => ({ status: 'ok', data: { status: 'saved', date: i.date, operation: i.operation }, meta })),
    read: jest.fn<DayWriteApi['read']>().mockImplementation(async d => ({ status: 'ok', data: nutritionFixture(d), meta })),
  };
  let n = 0;
  const make = () => new DayWriteController(api, new DayWriteRepository(port, 'owner'), jest.fn(), () => `k:${++n}`);
  const activity = nutritionFixture().activity;
  return { map, api, nutrition: make(), metrics: make(), metricId: activity.status === 'ok' ? activity.data.metrics[0].id : '' };
}

describe('Daily Metrics reuses the Nutrition writer with a shared intent', () => {
  it('a surface entering re-reads the intent the other surface left uncertain, and recovers it once', async () => {
    const s = surfaces();
    await s.nutrition.initialize(); await s.metrics.initialize();
    s.api.mutate.mockResolvedValueOnce(lost);
    s.metrics.open('metrics', nutritionFixture(date)); s.metrics.changeMetric(s.metricId, 'value', '7');
    await s.metrics.save();
    expect(s.metrics.getSnapshot().phase).toBe('uncertain');
    expect(s.nutrition.getSnapshot()).toMatchObject({ phase: 'idle', intent: null });
    await s.nutrition.resync();
    expect(s.nutrition.getSnapshot()).toMatchObject({ phase: 'uncertain', intent: { intent: { idempotencyKey: 'k:1' } } });
    await s.nutrition.recover();
    expect(s.api.mutate).toHaveBeenCalledTimes(2); expect(s.api.mutate.mock.calls[1][0]).toEqual(s.api.mutate.mock.calls[0][0]);
    expect(s.api.mutate.mock.calls[0][0]).toMatchObject({ operation: 'metrics', changes: [{ value: 7 }] });
    await s.metrics.resync();
    expect(s.metrics.getSnapshot()).toMatchObject({ phase: 'idle', intent: null, draft: null });
  });
  it('never sends a second intent while the other surface holds one (mutual exclusion)', async () => {
    const s = surfaces();
    await s.nutrition.initialize(); await s.metrics.initialize();
    s.api.mutate.mockResolvedValueOnce(lost);
    s.nutrition.open('metrics', nutritionFixture(date)); s.nutrition.changeMetric(s.metricId, 'value', '1');
    await s.nutrition.save();
    s.metrics.open('metrics', nutritionFixture(date)); s.metrics.changeMetric(s.metricId, 'value', '2');
    await s.metrics.save();
    expect(s.api.mutate).toHaveBeenCalledTimes(1);
    expect(s.metrics.getSnapshot()).toMatchObject({ phase: 'uncertain', intent: { intent: { idempotencyKey: 'k:1' } } });
  });
  it('resync never touches an open draft when the persisted intent did not change', async () => {
    const s = surfaces();
    await s.metrics.initialize();
    s.metrics.open('metrics', nutritionFixture(date)); s.metrics.changeMetric(s.metricId, 'value', '3,5');
    await s.metrics.resync();
    expect(s.metrics.getSnapshot()).toMatchObject({ phase: 'idle', draft: { metrics: { [s.metricId]: { value: '3,5' } } } });
  });
  it('future dates are not editable (server today), and the stable future conflict keeps the draft', async () => {
    expect(canWriteDay('metrics', nutritionFixture('2026-10-03'))).toBe(false);
    expect(canWriteDay('metrics', nutritionFixture(date))).toBe(true);
    const s = surfaces();
    await s.metrics.initialize();
    s.api.mutate.mockResolvedValueOnce({ status: 'conflict', code: 'METRIC_FUTURE_DATE', message: 'No se pueden registrar métricas en una fecha futura.', meta });
    s.metrics.open('metrics', nutritionFixture(date)); s.metrics.changeMetric(s.metricId, 'value', '9');
    await s.metrics.save();
    expect(s.metrics.getSnapshot()).toMatchObject({ phase: 'conflict', intent: null, message: 'No se pueden registrar métricas en una fecha futura.',
      draft: { metrics: { [s.metricId]: { value: '9' } } } });
    expect(s.map.size).toBe(0);
  });
});
