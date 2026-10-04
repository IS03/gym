import { describe, expect, it, jest } from '@jest/globals';
import type { BodyApi } from './body-controller';
import { BodyController } from './body-controller';
import { conflict, fakeApi, measurement, memoryStorage, ok, overview, repository, TODAY } from './body-fixture.test-helper';
const oldDate = '2020-01-01';
const old = measurement({ measuredOn: oldDate });
const exact = (weightKg = 70) => ({ date: oldDate, today: TODAY, weight: { status: 'ok' as const, data: { date: oldDate, weightKg } }, measurement: { status: 'ok' as const, data: old } });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
describe('M6 Body old-date truth', () => {
  it('edits weight beyond the first page, then adopts exact-date truth after CAS conflict', async () => {
    const api = { ...fakeApi(overview({ measurements: { items: [], nextBefore: null } })), day: jest.fn<NonNullable<BodyApi['day']>>().mockResolvedValue(ok(exact())) };
    const c = new BodyController(api, repository(memoryStorage().port), () => 'old-weight'); c.setDate(oldDate); await c.initialize();
    expect(c.getSnapshot().read.weights.some(x => x.date === oldDate)).toBe(false);
    const d = c.getSnapshot().read.day!; if (d.weight.status !== 'ok') throw new Error(); c.openWeight(d.weight.data!); c.change('weight', '72');
    api.weight.mockResolvedValue(conflict('WEIGHT_CHANGED')); api.day.mockResolvedValue(ok(exact(71)));
    await c.saveWeight(); await flush(); c.reviewTruth();
    expect(c.getSnapshot().editor).toMatchObject({ kind: 'weight', baseline: 71, draft: { weight: '72' } }); c.dispose();
  });
  it('recovers a moved measurement by identity rather than treating missing first-page row as deleted', async () => {
    const moved = { ...old, measuredOn: '2020-01-02', updatedAt: '2026-10-04T12:00:00.999999+00:00' };
    const api = { ...fakeApi(overview({ measurements: { items: [], nextBefore: null } })), day: jest.fn<NonNullable<BodyApi['day']>>().mockResolvedValue(ok(exact())),
      measurementById: jest.fn<NonNullable<BodyApi['measurementById']>>().mockResolvedValue(ok(moved)) };
    const c = new BodyController(api, repository(memoryStorage().port), () => 'old-measurement'); c.setDate(oldDate); await c.initialize(); c.openMeasurement(old); c.change('waistCm', '85');
    api.measurement.mockResolvedValue(conflict('MEASUREMENT_CHANGED')); await c.saveMeasurement(); await flush(); c.reviewTruth();
    expect(api.measurementById).toHaveBeenCalledWith(old.id); expect(c.getSnapshot().editor).toMatchObject({ kind: 'measurement', mode: 'edit', baseline: moved }); c.dispose();
  });
});
