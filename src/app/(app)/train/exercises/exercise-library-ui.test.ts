import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/(app)/train/exercises/exercise-library.tsx", "utf8");

describe("exercise library v2 composition", () => {
  it("keeps search and a compact, named filter trigger in the toolbar", () => {
    expect(source).toContain('placeholder="Buscar ejercicio"');
    expect(source).toContain('aria-label="Buscar ejercicio"');
    expect(source).toContain("aria-label={");
    expect(source).toContain('"Filtrar ejercicios"');
    expect(source).toContain('aria-label="Limpiar búsqueda"');
  });

  it("uses a responsive filter sheet with compact selectable group chips", () => {
    expect(source).toContain('<Sheet open={filtersOpen} onOpenChange={handleFiltersOpenChange}>');
    expect(source).toContain("Filtrar ejercicios");
    expect(source).toContain("aria-pressed={draftGroup === option.value}");
    expect(source).toContain("Ver {filterPreviewCount}");
  });

  it("renders divider rows and keeps the whole row as the edit trigger", () => {
    expect(source).toContain("function ExerciseRows");
    expect(source).toContain("divide-y divide-border/70");
    expect(source).toContain("onClick={() => onEdit(exercise)}");
    expect(source).toContain("groupExerciseLibrary(visibleExercises)");
  });

  it("keeps create, edit and archive flows in the same component", () => {
    expect(source).toContain("createExerciseAction(input)");
    expect(source).toContain("updateExerciseAction(editing.id, input)");
    expect(source).toContain("archiveExerciseAction(archiveTarget.id)");
  });

  it("keeps the exercise editor stable before an input is intentionally focused", () => {
    expect(source).not.toContain("autoFocus");
    expect(source).toContain('variant="editor"');
    expect(source).toContain("h-[min(82svh,42rem)] min-h-0");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain('aria-label="Cerrar formulario de ejercicio"');
  });
});
