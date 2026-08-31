import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/train/history/page.tsx", "utf8");
const sessions = readFileSync("src/app/(app)/train/history/history-session-list.tsx", "utf8");
const exercises = readFileSync("src/app/(app)/train/history/history-exercise-list.tsx", "utf8");
const directory = readFileSync("src/components/training/exercise-directory.tsx", "utf8");

describe("historial de entrenamiento v2", () => {
  it("conserva un único título de página y la navegación por URL", () => {
    expect(page).toContain('href="/train/history?view=sessions"');
    expect(page).toContain('href="/train/history?view=exercises"');
    expect(page).not.toContain('>Por ejercicio</h1>');
  });

  it("muestra continuidad y sesiones como colecciones densas navegables", () => {
    expect(sessions).toContain("Última");
    expect(sessions).toContain("Más tiempo sin hacer");
    expect(sessions).toContain("Sesiones recientes");
    expect(sessions).toContain("Ver más sesiones");
    expect(sessions).not.toContain('from "@/components/ui/card"');
    expect(sessions).toContain("href={`/train/session/${session.id}`}");
  });

  it("separa el historial por ejercicio de la presentación de progreso", () => {
    expect(exercises).toContain('placeholder="Buscar ejercicio"');
    expect(exercises).toContain("Filtrar ejercicios");
    expect(exercises).toContain("Ver {count}");
    expect(exercises).toContain("Último");
    expect(exercises).toContain("Mejor");
    expect(exercises).toContain('href={`/train/history/${item.id}?from=history`}');
    expect(directory).toContain('mode === "progress" && !hasActiveFilters ? filtered.slice(0, 6) : filtered');
    expect(directory).toContain("Mejor peso");
    expect(directory).toContain("Próxima sesión");
  });
});
