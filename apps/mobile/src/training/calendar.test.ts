import { describe, expect, it } from '@jest/globals';

import {
  buildTrainingMonth,
  formatTrainingDate,
  formatTrainingMonth,
  isoDateForDate,
  monthForDate,
} from './calendar';

describe('native Training calendar', () => {
  it('builds Monday-first months with visual empty cells', () => {
    const september = buildTrainingMonth('2026-09');

    expect(september).toHaveLength(5);
    expect(september[0]?.[0]).toBeNull();
    expect(september[0]?.[1]).toEqual({ date: '2026-09-01', day: 1 });
    expect(september[4]?.[2]).toEqual({ date: '2026-09-30', day: 30 });
    expect(september[4]?.[3]).toBeNull();
  });

  it('supports four- and six-week month grids', () => {
    expect(buildTrainingMonth('2021-02')).toHaveLength(4);
    expect(buildTrainingMonth('2026-08')).toHaveLength(6);
  });

  it('uses local calendar dates without UTC day drift', () => {
    const date = new Date(2026, 8, 7, 23, 30);
    expect(monthForDate(date)).toBe('2026-09');
    expect(isoDateForDate(date)).toBe('2026-09-07');
  });

  it('formats Spanish month and session labels', () => {
    expect(formatTrainingMonth('2026-09')).toBe('Septiembre de 2026');
    expect(formatTrainingDate('2026-09-21')).toContain('21 de septiembre de 2026');
  });
});

