import { describe, expect, it } from '@jest/globals';

import { parseMobileHomeResponse, type MobileHomeResponse } from './home';

const home: MobileHomeResponse = {
  date: '2026-09-21',
  profile: { status: 'ok', data: { displayName: 'Nacho' } },
  nutrition: {
    status: 'ok',
    data: {
      calories: 0,
      calorieTarget: 2_200,
      proteinG: 0,
      proteinTargetG: 140,
      mealCount: 0,
      waterL: null,
      waterTargetL: 3,
      energyBalanceKcal: 0,
    },
  },
  training: {
    activeSession: { status: 'ok', data: null },
    week: {
      status: 'ok',
      data: {
        summary: {
          weekStart: '2026-09-21',
          weekEnd: '2026-09-27',
          sessions: 0,
          sets: 0,
          minutes: 0,
          trainingDays: [],
        },
        todaySessions: [],
      },
    },
  },
};

describe('Mobile Home runtime parser', () => {
  it('accepts valid empty collections, null absence, and real zeroes', () => {
    expect(parseMobileHomeResponse(home)).toEqual(home);
  });

  it('preserves explicit partial unavailable blocks', () => {
    expect(
      parseMobileHomeResponse({
        ...home,
        nutrition: { status: 'unavailable' },
      }),
    ).toEqual({ ...home, nutrition: { status: 'unavailable' } });
  });

  it('rejects missing or corrupted values rather than inventing zero', () => {
    expect(
      parseMobileHomeResponse({
        ...home,
        nutrition: {
          status: 'ok',
          data: {
            ...(home.nutrition.status === 'ok' ? home.nutrition.data : {}),
            calories: null,
          },
        },
      }),
    ).toBeNull();
    expect(parseMobileHomeResponse({ date: home.date })).toBeNull();
  });
});
