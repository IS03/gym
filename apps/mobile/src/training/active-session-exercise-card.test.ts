import { describe, expect, it, jest } from '@jest/globals';

import { phaseIsFailure } from './active-session-exercise-card';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

describe('exercise status color semantics', () => {
  it('uses the error color only for real failures, never for states to know about', () => {
    expect(phaseIsFailure('retryable')).toBe(true);
    expect(phaseIsFailure('validation')).toBe(true);
    for (const phase of ['conflict', 'unconfirmed', 'stale', 'closed', 'removed'] as const) expect(phaseIsFailure(phase)).toBe(false);
  });
});
