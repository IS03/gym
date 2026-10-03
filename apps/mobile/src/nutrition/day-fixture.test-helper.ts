import type { MobileNutritionDayResponse } from '@/api/nutrition-day';
export const nutritionFixture = (date = '2026-10-02'): MobileNutritionDayResponse => ({
  date, today: '2026-10-02',
  nutrition: { status: 'ok', data: {
    dayState: 'recorded',
    summary: { entryCount: 1, mealCount: 1, calories: { knownTotal: 200, missingCount: 0 },
      proteinG: { knownTotal: 0, missingCount: 1 }, carbsG: { knownTotal: 20, missingCount: 0 }, fatG: { knownTotal: 0, missingCount: 0 } },
    context: { calorieTarget: 1800, proteinTargetG: 140, waterTargetL: 3, deltaVsTargetKcal: -1600,
      expenditureKcal: 2200, energyBalanceKcal: -2000, targetAutomaticKcal: 1800, targetOverrideKcal: null,
      expenditureAutomaticKcal: 2200, expenditureOverrideKcal: null, resolvedAt: '2026-10-02T12:00:00Z',
      training: { effective: null, source: null }, work: { effective: false, source: 'schedule' } },
    meals: [{ id: '41100000-0000-4000-8000-000000000002', title: `Comida ${date}`, description: null,
      calories: 200, proteinG: null, carbsG: 20, fatG: 0, consumedAt: `${date}T12:00:00Z`, updatedAt: `${date}T12:00:00Z`,
      timeKnown: true, entryKind: 'meal', sourceType: 'manual', precision: null, mealLabel: null }],
  } },
  activity: { status: 'ok', data: { metrics: [{ id: '41100000-0000-4000-8000-000000000003', systemKey: 'water',
    label: 'Agua', unit: 'L', valueType: 'decimal', target: 2, value: 0, isActive: true, updatedAt: `${date}T12:00:00Z` }] } },
});
