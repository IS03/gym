"use client";

import { startTransition, useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-context";
import { Button } from "@/components/ui/button";

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
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" disabled>
          …
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Apariencia</p>
      <div className="flex gap-2">
        {(
          [
            { id: "light" as const, label: "Claro" },
            { id: "dark" as const, label: "Oscuro" },
            { id: "system" as const, label: "Sistema" },
          ] as const
        ).map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant={theme === id ? "default" : "outline"}
            className="h-11 flex-1"
            onClick={() => setTheme(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Activo: {resolvedTheme === "dark" ? "oscuro" : "claro"}.
      </p>
    </div>
  );
}
