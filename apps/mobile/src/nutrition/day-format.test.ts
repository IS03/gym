import { describe, expect, it } from '@jest/globals';
import { nutrientAmount, nutritionToday, parseInputNutritionDate, shiftNutritionDate } from './day-format';
describe('Nutrition date and coverage presentation', () => {
  it('uses Cordoba today and calendar-safe navigation', () => {
    expect(nutritionToday(new Date('2026-10-03T02:59:59Z'))).toBe('2026-10-02');
    expect(nutritionToday(new Date('2026-10-03T03:00:00Z'))).toBe('2026-10-03');
    expect(shiftNutritionDate('2024-03-01', -1)).toBe('2024-02-29');
    expect(parseInputNutritionDate('29/02/2024')).toBe('2024-02-29');
    expect(parseInputNutritionDate('30/02/2026')).toBeUndefined();
  });
  it('distinguishes empty, all-unknown, partial and explicit zero', () => {
    expect(nutrientAmount({ knownTotal: 0, missingCount: 0 }, 0, 'g')).toBe('0 g');
    expect(nutrientAmount({ knownTotal: 0, missingCount: 1 }, 1, 'g')).toBe('Sin dato');
    expect(nutrientAmount({ knownTotal: 10, missingCount: 1 }, 2, 'g')).toBe('10 g · parcial');
    expect(nutrientAmount({ knownTotal: 0, missingCount: 0 }, 1, 'g')).toBe('0 g');
  });
});
