"use client";

import { startTransition, useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-context";

export function ThemeSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 rounded-lg border bg-muted/40" aria-hidden />
    );
  }

  return (
    <div className="space-y-1.5">
      <div role="group" aria-label="Tema" className="grid grid-cols-3 rounded-lg border bg-muted/40 p-1">
        {(
          [
            { id: "light" as const, label: "Claro" },
            { id: "dark" as const, label: "Oscuro" },
            { id: "system" as const, label: "Sistema" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={theme === id}
            className={`h-10 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${theme === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}
            onClick={() => setTheme(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {theme === "system" ? <p className="text-xs text-muted-foreground">Usando actualmente el tema {resolvedTheme === "dark" ? "oscuro" : "claro"}.</p> : null}
    </div>
  );
}
