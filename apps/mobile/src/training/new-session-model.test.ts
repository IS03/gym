import { describe, expect, it, jest } from '@jest/globals';

import type { MobileApiClient } from '@/api/client';
import type { TrainingHistorySession } from '@/api/training-history';

import { loadRecommendationData, recommendRoutine, sameWeekdayDates, weekdayName } from './new-session-model';

const mockHistory = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDay = jest.fn<(client: unknown, date: string) => Promise<unknown>>();
jest.mock('@/api/training-history', () => ({
  fetchTrainingDay: (client: unknown, date: string) => mockDay(client, date),
  fetchTrainingHistory: (...args: unknown[]) => mockHistory(...args),
}));

const TODAY = '2026-10-09'; // Friday
const session = (routineId: string | null, logDate: string, id = `${routineId}-${logDate}`): TrainingHistorySession => ({
  id, routineId, routineName: routineId ?? 'Libre', routineColor: null, logDate, startedAt: `${logDate}T12:00:00.000Z`, endedAt: `${logDate}T13:00:00.000Z`,
  durationMilliseconds: 3_600_000, exercisesCompleted: 6, completedSets: 20, volumeKg: null,
});
const ACTIVE = ['pull', 'push', 'legs'];

describe('Routine recommendation', () => {
  it('the routine done on most of the same weekdays (distinct days), only past days of the window', () => {
    const sessions = [
      session('pull', '2026-10-02'), session('pull', '2026-09-25'), session('pull', '2026-09-25', 'pull-twice'), // same day counts once
      session('push', '2026-09-18'), session('push', '2026-09-11'), session('push', '2026-09-04'),
      session('legs', '2026-10-08'), session('legs', '2026-10-07'), // not Fridays
    ];
    expect(recommendRoutine(sessions, ACTIVE, TODAY)).toEqual({ routineId: 'push', days: 3, doneToday: false });
  });

  it('ties go to the one done most recently', () => {
    const sessions = [session('push', '2026-09-11'), session('push', '2026-09-04'), session('pull', '2026-10-02'), session('pull', '2026-09-18')];
    expect(recommendRoutine(sessions, ACTIVE, TODAY)).toEqual({ routineId: 'pull', days: 2, doneToday: false });
  });

  it('a routine already done today is still the recommendation, flagged', () => {
    const sessions = [session('pull', '2026-10-02'), session('pull', '2026-09-25'), session('pull', '2026-09-18'),
      session('push', '2026-09-11'), session('push', '2026-09-04'), session('pull', TODAY)];
    expect(recommendRoutine(sessions, ACTIVE, TODAY)).toEqual({ routineId: 'pull', days: 3, doneToday: true });
  });

  it('no recommendation below the minimum, for free sessions, archived routines or outside the 12 weeks', () => {
    expect(recommendRoutine([session('pull', '2026-10-02')], ACTIVE, TODAY)).toBeNull();
    expect(recommendRoutine([session(null, '2026-10-02'), session(null, '2026-09-25')], ACTIVE, TODAY)).toBeNull();
    expect(recommendRoutine([session('old', '2026-10-02'), session('old', '2026-09-25')], ACTIVE, TODAY)).toBeNull();
    expect(recommendRoutine([session('pull', '2026-07-10'), session('pull', '2026-07-03')], ACTIVE, TODAY)).toBeNull();
    expect(recommendRoutine([], ACTIVE, TODAY)).toBeNull();
  });

  it('weekday names for copy', () => {
    expect(weekdayName(TODAY)).toBe('viernes');
    expect(weekdayName('2026-10-10', true)).toBe('sábados');
  });

  it('reads today and the same weekday of the last 12 weeks in parallel, plus one history page', async () => {
    const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
    expect(sameWeekdayDates(TODAY)).toHaveLength(13);
    expect(sameWeekdayDates(TODAY).slice(0, 3)).toEqual([TODAY, '2026-10-02', '2026-09-25']);
    expect(sameWeekdayDates(TODAY).at(-1)).toBe('2026-07-17');
    mockDay.mockReset(); mockHistory.mockReset();
    mockDay.mockImplementation(async (_client, date) => ({ status: 'ok', meta, data: { date, sessions: date === '2026-10-02' ? [session('pull', date)] : [], summary: {} } }));
    mockHistory.mockResolvedValue({ status: 'ok', meta, data: { sessions: [session('push', '2026-10-08')], nextCursor: 'p2' } });
    const data = await loadRecommendationData({} as MobileApiClient, TODAY);
    expect(mockDay).toHaveBeenCalledTimes(13); expect(mockHistory).toHaveBeenCalledTimes(1);
    expect(data).toEqual({ today: TODAY, sameWeekday: [session('pull', '2026-10-02')], recent: [session('push', '2026-10-08')] });
    // One failed day: the recommendation is unknown, never guessed from partial days.
    mockDay.mockImplementationOnce(async () => ({ status: 'unavailable', reason: 'network', meta }));
    expect((await loadRecommendationData({} as MobileApiClient, TODAY)).sameWeekday).toBeNull();
  });
});
