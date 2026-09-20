import { describe, expect, it } from '@jest/globals';

import { resolveThemeMode } from './theme';

describe('resolveThemeMode', () => {
  it('follows the system when preference is system', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  it('falls back to light when the system preference is unavailable', () => {
    expect(resolveThemeMode('system', null)).toBe('light');
  });

  it('honors an explicit preference', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });
});
