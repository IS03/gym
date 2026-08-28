"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY } from "@/lib/app-theme";

export type ThemeId = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeId;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeToDom(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "system";
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? null;
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === "undefined") return "light";
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? null;
    const initialTheme: ThemeId =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system";
    return initialTheme === "system" ? getSystemTheme() : initialTheme;
  });

  useLayoutEffect(() => {
    applyThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mql) return;

    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
    };

    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    const resolved = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider.");
  return ctx;
}

