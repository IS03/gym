import { describe, expect, it } from '@jest/globals';
import { fetchMobileNutritionDay, parseMobileNutritionDayResponse } from './nutrition-day';
import type { MobileApiClient } from './client';
import { nutritionFixture } from '@/nutrition/day-fixture.test-helper';

describe('Native Nutrition runtime contract', () => {
  it('preserves unknown/zero and independent availability; rejects false coverage', () => {
    const value = nutritionFixture();
    expect(parseMobileNutritionDayResponse(value)).toEqual(value);
    expect(parseMobileNutritionDayResponse({ ...value, activity: { status: 'unavailable' } })?.nutrition.status).toBe('ok');
    if (value.nutrition.status === 'ok' && value.nutrition.data.dayState === 'recorded') {
      value.nutrition.data.summary.proteinG.missingCount = 0;
      expect(parseMobileNutritionDayResponse(value)).toBeUndefined();
    }
    expect(parseMobileNutritionDayResponse({ ...value, date: '2026-02-30' })).toBeUndefined();
  });
  it('requires the response to represent the requested date', async () => {
    const read = async (options: Parameters<MobileApiClient['read']>[0]) => {
      expect(options.path).toBe('/api/mobile/v1/nutrition/days/2026-10-01');
      expect(options.parse(nutritionFixture('2026-10-02'))).toBeUndefined();
      expect(options.parse(nutritionFixture('2026-10-01'))).toBeDefined();
      return { status: 'unavailable' as const, reason: 'invalid_response' as const,
        meta: { durationMs: 0, httpStatus: 200, outcome: 'unavailable' as const } };
    };
    await fetchMobileNutritionDay({ read } as MobileApiClient, '2026-10-01');
  });
});
