import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import { type ColorSchemeName, useColorScheme } from 'react-native';

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
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type OwnlevelThemeProviderProps = PropsWithChildren<{
  initialMode?: ThemeMode;
}>;

export function OwnlevelThemeProvider({ children, initialMode = 'system' }: OwnlevelThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const resolvedMode = resolveThemeMode(mode, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: resolvedMode === 'dark' ? darkColors : lightColors,
      isDark: resolvedMode === 'dark',
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode],
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
