import type { ThemeMode } from './theme';

// Device preference (not per user, not on the server): one namespaced key.
export const THEME_PREFERENCE_KEY = 'ownlevel.theme.v1';
const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];
export const isThemeMode = (value: unknown): value is ThemeMode => typeof value === 'string' && MODES.includes(value as ThemeMode);

export type ThemePreferenceStorage = { read: () => Promise<ThemeMode | null>; write: (mode: ThemeMode) => Promise<void> };
type StoragePort = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };

/** Corrupt or unknown values read as "no preference" (the provider falls back to system). */
export function createThemePreferenceStorage(port: StoragePort): ThemePreferenceStorage {
  return {
    read: async () => { const raw = await port.getItem(THEME_PREFERENCE_KEY); return isThemeMode(raw) ? raw : null; },
    write: mode => port.setItem(THEME_PREFERENCE_KEY, mode),
  };
}
