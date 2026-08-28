"use client";

import { ThemeProvider as LocalThemeProvider } from "./theme-context";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <LocalThemeProvider>{children}</LocalThemeProvider>;
}
