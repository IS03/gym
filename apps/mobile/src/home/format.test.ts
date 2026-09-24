import { describe, expect, it } from '@jest/globals';

import {
  addIsoDays,
  entriesByCount,
  firstName,
  formatDuration,
  formatEnergyBalance,
  formatInteger,
  formatTrainingMinutes,
  profileInitial,
} from './format';

describe('Home formatting', () => {
  it('uses es-AR numbers and compact durations', () => {
    expect(formatInteger(1234)).toBe('1.234');
    expect(formatDuration(65 * 60_000)).toBe('1 h 5 min');
    expect(formatTrainingMinutes(120)).toBe('2 h');
  });

  it('preserves null and zero semantics', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatEnergyBalance(null)).toBe('—');
    expect(formatEnergyBalance(0)).toBe('0 kcal');
  });

  it('formats the compact profile identity', () => {
    expect(firstName('  Ignacio OWNLEVEL  ')).toBe('Ignacio');
    expect(profileInitial('ñacho')).toBe('Ñ');
    expect(firstName(null)).toBe('Perfil');
    expect(profileInitial(null)).toBeNull();
  });

  it('builds logical week dates without device-local today semantics', () => {
    expect(addIsoDays('2026-09-21', 6)).toBe('2026-09-27');
    expect(entriesByCount({ Push: 1, Pull: 3, Legs: 3 })).toEqual([
      ['Legs', 3],
      ['Pull', 3],
      ['Push', 1],
    ]);
  });
});
