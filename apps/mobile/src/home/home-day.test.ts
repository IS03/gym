import { describe, expect, it, jest } from '@jest/globals';

import type { MobileApiClient } from '@/api/client';

import { HOME_FOCUS_REFRESH_MS, loadTrainingWeek, shouldRefreshOnFocus } from './home-data';
import { elapsedMinutes, headerDate, homeDay, mondayOf, readAge, weekDates } from './home-day';

const mockFetchHistory = jest.fn<(client: unknown, cursor: string | null) => Promise<unknown>>();
jest.mock('@/api/training-history', () => ({ fetchTrainingHistory: (c: unknown, cursor: string | null) => mockFetchHistory(c, cursor) }));
jest.mock('@/api', () => ({ fetchMobileHome: jest.fn(), useApiResource: jest.fn() }));

const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const session = (id: string, logDate: string, completedSets = 10) => ({
  id, routineId: null, routineName: id, routineColor: null, logDate, startedAt: `${logDate}T12:00:00.000Z`, endedAt: `${logDate}T13:00:00.000Z`,
  durationMilliseconds: 3_600_000, exercisesCompleted: 4, completedSets, volumeKg: null,
});

describe('Home day semantics (same as the server: Córdoba day, Monday week)', () => {
  it('changes day and week exactly at Córdoba midnight (UTC−3)', () => {
    // Sunday 23:59:59 in Córdoba.
    expect(homeDay(new Date('2026-10-12T02:59:59.000Z'))).toEqual({ today: '2026-10-11', weekStart: '2026-10-05' });
    // Monday 00:00:00 in Córdoba: new day and new week.
    expect(homeDay(new Date('2026-10-12T03:00:00.000Z'))).toEqual({ today: '2026-10-12', weekStart: '2026-10-12' });
  });

  it('weeks start on Monday and list seven days', () => {
    expect(mondayOf('2026-10-10')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
    expect(weekDates('2026-10-05')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('formats the header date and the age of the last confirmed read', () => {
    expect(headerDate('2026-10-10')).toBe('SÁBADO 10 DE OCTUBRE');
    expect(readAge(0, 30_000)).toBe('hace un momento');
    expect(readAge(0, 5 * 60_000)).toBe('hace 5 min');
    expect(readAge(0, 2 * 3_600_000)).toBe('hace 2 h');
    expect(elapsedMinutes('2026-10-10T12:00:00.000Z', Date.parse('2026-10-10T12:23:30.000Z'))).toBe(23);
  });
});

describe('Home focus refresh', () => {
  it('keeps confirmed reads inside the minimum interval and refreshes after it or on a new day', () => {
    const last = { at: 1_000, day: '2026-10-10' };
    expect(shouldRefreshOnFocus(null, 1_000, '2026-10-10')).toBe(true);
    expect(shouldRefreshOnFocus(last, 1_000 + HOME_FOCUS_REFRESH_MS - 1, '2026-10-10')).toBe(false);
    expect(shouldRefreshOnFocus(last, 1_000 + HOME_FOCUS_REFRESH_MS, '2026-10-10')).toBe(true);
    expect(shouldRefreshOnFocus(last, 1_001, '2026-10-11')).toBe(true);
  });
});

describe('loadTrainingWeek', () => {
  const client = {} as MobileApiClient;

  it('keeps only this week and stops at the first older session', async () => {
    mockFetchHistory.mockReset();
    mockFetchHistory.mockResolvedValueOnce({ status: 'ok', meta, data: { sessions: [session('a', '2026-10-07'), session('b', '2026-10-05'), session('c', '2026-10-02')], nextCursor: 'x' } });
    const result = await loadTrainingWeek(client, '2026-10-05');
    expect(result).toEqual({ status: 'ok', meta, data: { weekStart: '2026-10-05', everTrained: true, sessions: [session('a', '2026-10-07'), session('b', '2026-10-05')] } });
    expect(mockFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('pages while the week continues and reports a user who never trained', async () => {
    mockFetchHistory.mockReset();
    mockFetchHistory
      .mockResolvedValueOnce({ status: 'ok', meta, data: { sessions: [session('a', '2026-10-09')], nextCursor: 'p2' } })
      .mockResolvedValueOnce({ status: 'ok', meta, data: { sessions: [session('b', '2026-10-06')], nextCursor: null } });
    const result = await loadTrainingWeek(client, '2026-10-05');
    expect(result.status === 'ok' && result.data.sessions.map(s => s.id)).toEqual(['a', 'b']);
    expect(mockFetchHistory.mock.calls.map(([, cursor]) => cursor)).toEqual([null, 'p2']);

    mockFetchHistory.mockReset();
    mockFetchHistory.mockResolvedValueOnce({ status: 'ok', meta, data: { sessions: [], nextCursor: null } });
    const empty = await loadTrainingWeek(client, '2026-10-05');
    expect(empty.status === 'ok' && empty.data).toEqual({ weekStart: '2026-10-05', everTrained: false, sessions: [] });
  });

  it('a failed page is unavailable, never a partial week', async () => {
    mockFetchHistory.mockReset();
    mockFetchHistory
      .mockResolvedValueOnce({ status: 'ok', meta, data: { sessions: [session('a', '2026-10-09')], nextCursor: 'p2' } })
      .mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta });
    expect((await loadTrainingWeek(client, '2026-10-05')).status).toBe('unavailable');
  });
});
