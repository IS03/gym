import { describe, expect, it } from '@jest/globals';
import { buildDayWriteIntent, canWriteDay, dayWriteDraft } from './day-write-model';
import { nutritionFixture } from './day-fixture.test-helper';
describe('M6 archived metrics today', () => {
  it('retains the recorded value but never includes it in a today mutation', () => {
    const data = nutritionFixture(); data.today = data.date;
    if (data.activity.status !== 'ok') throw new Error();
    const archived = data.activity.data.metrics[0]; archived.isActive = false;
    const draft = dayWriteDraft('metrics', data); draft.metrics[archived.id].value = '8';
    expect(canWriteDay('metrics', data)).toBe(data.activity.data.metrics.some(m => m.isActive));
    expect(buildDayWriteIntent(draft, 'k').intent).toBeUndefined(); expect(archived.value).not.toBeNull();
    data.today = '2026-10-03'; expect(canWriteDay('metrics', data)).toBe(true);
    expect(buildDayWriteIntent(dayWriteDraft('metrics', data), 'k').empty).toBe(true);
  });
});
