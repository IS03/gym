import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MobileApiClient } from '@/api/client';
import type { TrainingHistorySession } from '@/api/training-history';
import { homeDay, mondayOf, weekDates } from '@/home/home-day';
import { HUB_WEEK_PAGE_BUDGET, TrainingHubCache, hubRoutineMetadata, hubWeekTotals, loadHubWeek, shiftHubMonth } from './training-hub-data';

const mockHistory = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockMonth = jest.fn<(...args: unknown[]) => Promise<unknown>>();
jest.mock('@/api/training-history', () => ({ fetchTrainingHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock('@/api/training', () => ({ fetchMobileTraining: (...args: unknown[]) => mockMonth(...args) }));
const client = {} as MobileApiClient;
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const row = (id: string, logDate: string, sets = 3): TrainingHistorySession => ({
  id, logDate, routineId: 'r1', routineName: 'PUSH', routineColor: 'blue', startedAt: `${logDate}T12:00:00Z`,
  endedAt: `${logDate}T13:00:00Z`, durationMilliseconds: 60_000, exercisesCompleted: 1, completedSets: sets, volumeKg: null,
});
const page = (sessions: TrainingHistorySession[], nextCursor: string | null = null) => ({ status: 'ok', data: { sessions, nextCursor }, meta });

describe('Training hub calendar data', () => {
  beforeEach(() => { mockHistory.mockReset(); mockMonth.mockReset(); });
  it('uses the Cordoba server day across midnight, month and year boundaries', () => {
    expect(homeDay(new Date('2027-01-01T02:59:59Z')).today).toBe('2026-12-31');
    expect(homeDay(new Date('2027-01-01T03:00:00Z')).today).toBe('2027-01-01');
    expect(mondayOf('2027-01-03')).toBe('2026-12-28');
    expect(weekDates(mondayOf('2026-11-01'))).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(shiftHubMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftHubMonth('2026-12', 1)).toBe('2027-01');
  });
  it('filters stored logDate, deduplicates pages and computes totals from the same week', async () => {
    const monday = row('m', '2026-10-05', 21);
    mockHistory.mockResolvedValueOnce(page([row('future', '2026-10-12'), row('sunday', '2026-10-11', 5), monday], 'next'));
    mockHistory.mockResolvedValueOnce(page([monday, row('old', '2026-10-04')], 'older'));
    const result = await loadHubWeek(client, '2026-10-05');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected complete week');
    expect(result.data.sessions.map(session => session.id)).toEqual(['m', 'sunday']);
    expect(hubWeekTotals(result.data)).toEqual({ sessions: 2, sets: 26 });
    expect(mockHistory.mock.calls.map(call => call[1])).toEqual([null, 'next']);
  });
  it('does not stop early when an old logDate belongs to a session finished later', async () => {
    mockHistory.mockResolvedValueOnce(page([{ ...row('long', '2026-09-30'), endedAt: '2026-10-07T12:00:00Z' }], 'next'));
    mockHistory.mockResolvedValueOnce(page([row('week', '2026-10-05')]));
    const result = await loadHubWeek(client, '2026-10-05');
    expect(result.status === 'ok' && result.data.sessions.map(session => session.id)).toEqual(['week']);
    expect(mockHistory).toHaveBeenCalledTimes(2);
  });
  it('keeps an incomplete week unavailable, never a partial or zero total', async () => {
    mockHistory.mockResolvedValueOnce(page([row('week', '2026-10-07')], 'next'));
    mockHistory.mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta });
    expect((await loadHubWeek(client, '2026-10-05')).status).toBe('unavailable');
    mockHistory.mockReset(); mockHistory.mockResolvedValue(page([row('week', '2026-10-07')], 'repeated'));
    expect((await loadHubWeek(client, '2026-10-05')).status).toBe('unavailable');
    expect(mockHistory).toHaveBeenCalledTimes(2);
  });
  it('does not silently truncate a week when the scan budget is exhausted', async () => {
    let cursor = 0;
    mockHistory.mockImplementation(async () => page([row('new', '2026-10-20')], `cursor-${++cursor}`));
    expect((await loadHubWeek(client, '2026-10-05')).status).toBe('unavailable');
    expect(mockHistory).toHaveBeenCalledTimes(HUB_WEEK_PAGE_BUDGET);
  });
  it('reuses month/week caches and never reads extra history for recency', async () => {
    mockHistory.mockResolvedValue(page([row('week', '2026-10-07'), row('too-old', '2026-08-31')]));
    const cache = new TrainingHubCache(client);
    expect(cache.month('2026-10')).toBe(cache.month('2026-10'));
    expect(cache.week('2026-10-07')).toBe(cache.week('2026-10-11'));
    await cache.week('2026-10-07').refresh('initial');
    expect(cache.observedSessions('2026-10-07').map(session => session.id)).toEqual(['week']);
    expect(hubRoutineMetadata(8, 'r1', cache.observedSessions('2026-10-07'), '2026-10-07')).toBe('8 ejercicios · hoy');
    expect(hubRoutineMetadata(1, 'unknown', cache.observedSessions('2026-10-07'), '2026-10-07')).toBe('1 ejercicio');
    expect(hubRoutineMetadata(6, 'r1', [row('last', '2026-10-05')], '2026-10-07')).toBe('6 ejercicios · última hace 2 días');
    expect(mockHistory).toHaveBeenCalledTimes(1); expect(mockMonth).not.toHaveBeenCalled();
    cache.dispose();
  });
});
