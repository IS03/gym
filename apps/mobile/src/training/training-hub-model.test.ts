import { describe, expect, it } from '@jest/globals';

import type { TrainingHistorySession } from '@/api/training-history';
import { weekDates } from '@/home/home-day';

import { buildTrainingMonth } from './calendar';
import { dayBlock, monthCells, monthTrainedDays, orderDaySessions, pickerYears, routineLastDone, sessionDay, weekMarks } from './training-hub-model';

const session = (id: string, logDate: string, minutes: number | null, startedAt: string, routineId: string | null = null): TrainingHistorySession => ({
  id, routineId, routineName: id, routineColor: null, logDate, startedAt, endedAt: startedAt,
  durationMilliseconds: minutes === null ? null : minutes * 60_000, exercisesCompleted: 4, completedSets: 10, volumeKg: null,
});

describe('Training hub model', () => {
  it('a session belongs to its server logDate, even when it crosses midnight or the device is in another time zone', () => {
    // Started Thu 23:30 in Córdoba (02:30Z Friday), ended Friday: it stays on Thursday.
    const late = session('late', '2026-10-08', 50, '2026-10-09T02:30:00.000Z');
    expect(sessionDay(late)).toBe('2026-10-08');
    expect(dayBlock('2026-10-08', [late]).kind).toBe('single');
    expect(dayBlock('2026-10-09', [late]).kind).toBe('empty');
    // A UTC+9 clock would read "2026-10-09" from the timestamp; the day still comes from the server.
    const tokyo = session('tokyo', '2026-10-08', 30, '2026-10-08T16:00:00.000Z');
    expect(sessionDay(tokyo)).toBe('2026-10-08');
  });

  it('no sessions: the empty block for that date', () => {
    expect(dayBlock('2026-10-08', [])).toEqual({ kind: 'empty', date: '2026-10-08' });
  });

  it('one session: single block', () => {
    const one = session('push', '2026-10-08', 81, '2026-10-08T12:00:00.000Z');
    expect(dayBlock('2026-10-08', [one])).toEqual({ kind: 'single', date: '2026-10-08', main: one });
  });

  it('two sessions: the longest is the main one, whatever the start order', () => {
    const abs = session('abs', '2026-10-08', 14, '2026-10-08T11:00:00.000Z');
    const push = session('push', '2026-10-08', 81, '2026-10-08T12:00:00.000Z');
    const block = dayBlock('2026-10-08', [abs, push]);
    expect(block).toEqual({ kind: 'multiple', date: '2026-10-08', main: push, others: [abs], remaining: 0 });
  });

  it('a duration tie goes to the session that started first; an unknown duration ranks last', () => {
    const second = session('second', '2026-10-08', 40, '2026-10-08T15:00:00.000Z');
    const first = session('first', '2026-10-08', 40, '2026-10-08T09:00:00.000Z');
    const unknown = session('unknown', '2026-10-08', null, '2026-10-08T07:00:00.000Z');
    expect(orderDaySessions([unknown, second, first]).map(s => s.id)).toEqual(['first', 'second', 'unknown']);
  });

  it('more than three extra sessions: three shown and the rest counted', () => {
    const many = [90, 50, 40, 30, 20, 10].map((minutes, index) => session(`s${index}`, '2026-10-08', minutes, `2026-10-08T0${index}:00:00.000Z`));
    const block = dayBlock('2026-10-08', many);
    expect(block.kind === 'multiple' && [block.main.id, block.others.map(s => s.id), block.remaining]).toEqual(['s0', ['s1', 's2', 's3'], 2]);
  });

  it('week marks: trained days, today and future; a week across a month change', () => {
    const dates = weekDates('2026-09-28'); // Mon 28 Sep → Sun 4 Oct
    const marks = weekMarks(dates, '2026-10-01', new Set(['2026-09-29', '2026-10-01']), new Set(['2026-09', '2026-10']));
    expect(marks.filter(mark => mark.trained).map(mark => mark.date)).toEqual(['2026-09-29', '2026-10-01']);
    expect(marks.find(mark => mark.isToday)).toMatchObject({ date: '2026-10-01', trained: true, future: false });
    expect(marks.filter(mark => mark.future).map(mark => mark.date)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    // September not read: its days are unknown, never "not trained".
    const partial = weekMarks(dates, '2026-10-01', new Set(['2026-10-01']), new Set(['2026-10']));
    expect(partial.filter(mark => !mark.known).map(mark => mark.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
  });

  it('"N días entrenados" counts distinct days of that month only', () => {
    expect(monthTrainedDays(['2026-10-05', '2026-10-05', '2026-10-07', '2026-09-30'], '2026-10')).toBe(2);
    expect(monthTrainedDays([], '2026-10')).toBe(0);
  });

  it('routine last done: hoy / ayer / hace N días, from what was read; null when nothing was read', () => {
    const sessions = [session('a', '2026-10-05', 30, 'x', 'push'), session('b', '2026-10-07', 30, 'x', 'pull'), session('c', '2026-10-08', 30, 'x', 'legs')];
    expect(routineLastDone('legs', sessions, '2026-10-08')).toBe('hoy');
    expect(routineLastDone('pull', sessions, '2026-10-08')).toBe('ayer');
    expect(routineLastDone('push', sessions, '2026-10-08')).toBe('hace 3 días');
    expect(routineLastDone('abs', sessions, '2026-10-08')).toBeNull();
    // Month change.
    expect(routineLastDone('push', [session('d', '2026-09-30', 30, 'x', 'push')], '2026-10-02')).toBe('hace 2 días');
  });

  it('month grid: padding cells, today, future and trained days; an unread month marks nothing', () => {
    const cells = monthCells(buildTrainingMonth('2026-10'), '2026-10-09', new Set(['2026-10-05', '2026-10-09']));
    expect(cells[0].slice(0, 3)).toEqual([null, null, null]); // Oct 1st is a Thursday
    const flat = cells.flat().filter(Boolean);
    expect(flat.find(cell => cell!.date === '2026-10-09')).toEqual({ date: '2026-10-09', day: 9, trained: true, isToday: true, future: false });
    expect(flat.find(cell => cell!.date === '2026-10-05')!.trained).toBe(true);
    expect(flat.find(cell => cell!.date === '2026-10-10')!.future).toBe(true);
    expect(monthCells(buildTrainingMonth('2026-10'), '2026-10-09', null).flat().some(cell => cell?.trained)).toBe(false);
  });

  it('picker years: five back and the next one', () => {
    expect(pickerYears('2026-10-09')).toEqual([2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  });
});
