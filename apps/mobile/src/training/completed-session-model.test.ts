import { describe, expect, it } from '@jest/globals';
import { completedSessionModel, metadataItems, postWorkoutSummary, sessionDuration } from './completed-session-model';
import { testDetail, testFinished } from './active-session-test-fixtures';

describe('read-only completed session model', () => {
  it('shows only answered metadata: missing stays absent, a recorded 0 pain is shown', () => {
    expect(metadataItems({ energyLevel: null, performanceLevel: null, painLevel: null, notes: null })).toEqual([]);
    expect(metadataItems({ energyLevel: 4, performanceLevel: null, painLevel: 0, notes: 'ok' }).map(item => [item.label, item.value]))
      .toEqual([['Energía', '4/5'], ['Dolor', '0/10'], ['Notas', 'ok']]);
  });
  it('derives totals from server truth sets only', () => {
    const detail = testDetail();
    detail.session = { ...detail.session, status: 'completed', endedAt: '2026-09-30T13:05:00.000000+00:00' };
    detail.exercises[0].payload.sets[0].isCompleted = true;
    const model = completedSessionModel(detail);
    expect(model).toMatchObject({ status: 'completed', exerciseCount: 2, completedExerciseCount: 1, completedSetCount: 1, duration: '1 h 04 min', metadata: [] });
    expect(model.exercises[0].sets[0]).toEqual({ setNumber: 1, label: '40 kg × 8', completed: true });
    expect(model.exercises[1].sets[0].completed).toBe(false);
  });
  it('never invents a duration from missing or inconsistent timestamps', () => {
    expect(sessionDuration('2026-09-30T12:00:00Z', null)).toBeNull();
    expect(sessionDuration('2026-09-30T12:00:00Z', '2026-09-30T11:00:00Z')).toBeNull();
  });
  it('builds the post-workout base exactly from the finish response', () => {
    expect(postWorkoutSummary(testFinished({ energyLevel: null, performanceLevel: 3, painLevel: null, notes: null }))).toEqual({
      name: 'Sesión libre', duration: '1 h 04 min', line: '1 serie completada · 1 ejercicio', metadata: [{ key: 'performanceLevel', label: 'Rendimiento', value: '3/5' }],
    });
  });
});
