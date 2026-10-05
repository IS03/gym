import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type ColorSchemeName, useColorScheme } from 'react-native';

import type { ThemePreferenceStorage } from './theme-preference';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export function resolveThemeMode(
  preference: ThemeMode,
  systemScheme: ColorSchemeName | null | undefined,
): ResolvedTheme {
  if (preference !== 'system') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  resolvedMode: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** The last change applied but could not be saved on this device. */
  persistenceFailed: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type OwnlevelThemeProviderProps = PropsWithChildren<{
  initialMode?: ThemeMode;
  /** When provided, the preference is restored on start and saved on change. */
  persistence?: ThemePreferenceStorage;
}>;

export function OwnlevelThemeProvider({ children, initialMode = 'system', persistence }: OwnlevelThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [persistenceFailed, setPersistenceFailed] = useState(false);
  const chosen = useRef(false);

  // Boot never waits for storage: render with the fallback, apply the saved value if
  // it arrives before the user picks one. Read failures keep the fallback.
  useEffect(() => {
    if (!persistence) return;
    let cancelled = false;
    persistence.read()
      .then(saved => { if (!cancelled && saved && !chosen.current) setModeState(saved); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [persistence]);

  const setMode = useCallback((next: ThemeMode) => {
    chosen.current = true;
    setModeState(next);
    if (!persistence) return;
    persistence.write(next)
      .then(() => setPersistenceFailed(false))
      .catch(() => setPersistenceFailed(true));
  }, [persistence]);

  const resolvedMode = resolveThemeMode(mode, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolvedMode === 'dark' ? darkColors : lightColors,
      isDark: resolvedMode === 'dark',
      mode,
      resolvedMode,
      setMode,
      persistenceFailed,
    }),
    [mode, resolvedMode, setMode, persistenceFailed],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useOwnlevelTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useOwnlevelTheme must be used inside OwnlevelThemeProvider');
  }

  return value;
}
