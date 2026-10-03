import { describe, expect, it } from '@jest/globals';
import type { TrainingHistorySession } from '@/api/training-history';
import { testDetail } from './active-session-test-fixtures';
import {
  addMonths, correctionDraft, correctionInput, correctionIsDirty, groupSessionsByDate, markLabel, markMetadata, mergeHistoryPage, sessionTotals,
} from './history-model';

const base: TrainingHistorySession = { id: 'a', routineId: null, routineName: 'PUSH', routineColor: null, logDate: '2026-10-01',
  startedAt: '2026-10-01T12:00:00Z', endedAt: '2026-10-01T13:00:00Z', durationMilliseconds: null, exercisesCompleted: 1, completedSets: 3, volumeKg: null };
function completed() {
  const detail = testDetail();
  detail.session = { ...detail.session, status: 'completed', endedAt: '2026-09-30T13:05:00.000000+00:00',
    metadata: { ...detail.session.metadata, painNote: 'rodilla', treadmillMinutes: 12, energyLevel: 3 } };
  detail.exercises[0].payload = { ...detail.exercises[0].payload, notes: 'nota ejercicio',
    sets: detail.exercises[0].payload.sets.map(set => ({ ...set, notes: 'nota serie' })) };
  return detail;
}

describe('history presentation (server truth only)', () => {
  it('formats marks like Web and never turns a missing value into 0', () => {
    expect(markLabel({ weightKg: 62.5, reps: 5 })).toBe('62,5 kg × 5');
    expect(markLabel({ weightKg: null, reps: 12 })).toBe('12 reps');
    expect(markLabel({ weightKg: 0, reps: null })).toBe('0 kg');
    expect(markLabel(null)).toBe('—');
    expect(markMetadata(1, [])).toBe('1 serie'); expect(markMetadata(3, [2, 1])).toBe('3 series · RIR 2 / 1');
    expect(sessionTotals(base)).toBe('1 ejercicio · 3 series · Volumen sin registrar');
  });
  it('groups newest day first, merges pages without duplicates and walks months across years', () => {
    const rows = [{ ...base, id: 'a', logDate: '2026-09-30' }, { ...base, id: 'b', startedAt: '2026-10-01T08:00:00Z' }, { ...base, id: 'c' }];
    expect(groupSessionsByDate(rows).map(group => [group.date, group.sessions.map(session => session.id)]))
      .toEqual([['2026-10-01', ['c', 'b']], ['2026-09-30', ['a']]]);
    expect(mergeHistoryPage(rows.slice(0, 2), rows.slice(1)).map(session => session.id)).toEqual(['a', 'b', 'c']);
    expect(addMonths('2026-01', -1)).toBe('2025-12'); expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});

describe('historical correction draft', () => {
  it('sends only actuals/summary edits and preserves every frozen or non-edited field verbatim', () => {
    const detail = completed();
    const draft = correctionDraft(detail);
    expect(correctionIsDirty(detail, draft)).toBe(false);
    draft.exercises[0].sets[0] = { ...draft.exercises[0].sets[0], weight: '42,5', reps: '' };
    draft.painLevel = 0; draft.energyLevel = null; draft.notes = '';
    expect(correctionIsDirty(detail, draft)).toBe(true);
    const input = correctionInput(detail, draft, 'correct:1');
    expect(input.expectedSessionUpdatedAt).toBe(detail.session.updatedAt);
    expect(input.metadata).toEqual({ ...detail.session.metadata, energyLevel: null, painLevel: 0, notes: null });
    expect(input.metadata.painNote).toBe('rodilla'); expect(input.metadata.treadmillMinutes).toBe(12);
    expect(input.exercises).toHaveLength(detail.exercises.length);
    expect(input.exercises[0]).toMatchObject({ sessionExerciseId: detail.exercises[0].id, expectedUpdatedAt: detail.exercises[0].updatedAt, notes: 'nota ejercicio' });
    // Empty reps stay null (missing), not 0; set notes are kept.
    expect(input.exercises[0].sets[0]).toEqual({ setNumber: 1, actualWeightKg: 42.5, actualReps: null, notes: 'nota serie' });
    expect(input.idempotencyKey).toBe('correct:1');
  });
  it('rejects invalid actuals with a message naming the set and exercise', () => {
    const detail = completed();
    const draft = correctionDraft(detail);
    draft.exercises[0].sets[0].reps = '8,5';
    expect(() => correctionInput(detail, draft, 'k')).toThrow(/reps de la serie 1 de PRESS/);
    draft.exercises[0].sets[0].reps = '8'; draft.exercises[0].sets[0].weight = '10000';
    expect(() => correctionInput(detail, draft, 'k')).toThrow(/peso de la serie 1 de PRESS/);
  });
});
