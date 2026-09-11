import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/(app)/train/exercises/exercise-library.tsx", "utf8");
const pageSource = readFileSync("src/app/(app)/train/exercises/page.tsx", "utf8");

describe("exercise library v2 composition", () => {
  it("usa buscador live y una lista plana mientras existe query", () => {
    expect(source).toContain('placeholder="Buscar ejercicio, músculo o implemento"');
    expect(source).toContain("query.trim() ?");
    expect(source).toContain("sortExerciseLibrary(visibleExercises)");
  });
  it("renderiza grupos retráctiles con conteos del dataset visible", () => {
    expect(source).toContain("groupExerciseLibrary(visibleExercises)");
    expect(source).toContain("aria-expanded={open}");
    expect(source).toContain("section.exercises.length");
    expect(source).toContain("openGroups");
  });
  it("mantiene filtros draft, chips, limpiar y footer estable", () => {
    expect(source).toContain("cloneFilters(filters)");
    expect(source).toContain('aria-label="Filtros activos"');
    expect(source).toContain("clearDraftFilters");
    expect(source).toContain("previewExercises.length");
    expect(source).toContain("Ver ejercicios");
  });
  it("estructura el uso en rutinas sin mezclar pertenencia y rutinas específicas", () => {
    expect(source).toContain('title="Uso en rutinas"');
    expect(source).toContain('{ value: "any", label: "Cualquiera" }');
    expect(source).toContain('{ value: "assigned", label: "En rutina" }');
    expect(source).toContain('{ value: "unassigned", label: "Sin rutina" }');
    expect(source).toContain('draftRoutineUsage === "assigned"');
    expect(source).toContain('aria-label="Rutinas activas"');
    expect(source).toContain("routineColorCssVariable(routine.color)");
    expect(pageSource).toContain("listRoutines({ includeArchived: false })");
  });
  it("usa grillas alineadas y separa Sin clasificar del grupo muscular", () => {
    expect(source).toContain('aria-label="Grupos musculares"');
    expect(source).toContain("grid grid-cols-2 gap-2");
    expect(source).toContain("Sin clasificar");
    expect(source).toContain("Mostrar ejercicios sin grupo muscular asignado.");
    expect(source).not.toContain("function FilterChoice");
  });
  it("resume implementos en una row y conserva su multiselección en un selector secundario", () => {
    expect(source).toContain("implementSelectionSummary(draftFilters.implements)");
    expect(source).toContain("setImplementsOpen(true)");
    expect(source).toContain('title="Implementos"');
    expect(source).toContain('aria-label="Seleccionar implementos"');
    expect(source).toContain("toggleValue(draftFilters.implements, item)");
  });
  it("mantiene Estado como segmented y aplica el contador dinámico del draft", () => {
    expect(source).toContain('title="Mostrar"');
    expect(source).toContain('label="Estado del ejercicio"');
    expect(source).toContain("previewExercises.length");
    expect(source).toContain("setFilters(cloneFilters(draftFilters))");
  });
  it("comparte un único formulario para crear y editar", () => {
    expect(source).toContain("function ExerciseForm");
    expect(source).toContain("editing ? await updateExerciseAction");
    expect(source).toContain(": await createExerciseAction");
    expect(source).toContain("Valores por defecto");
    expect(source).toContain("Usado en rutinas");
  });
  it("usa sheet grande, scroll único y CTA sticky con safe area", () => {
    expect(source).not.toContain("autoFocus");
    expect(source).toContain("h-[min(92dvh,52rem)]");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain("initialFocus={editorCloseRef}");
  });
  it("conecta archive y restore sin borrar historia", () => {
    expect(source).toContain("archiveExerciseAction(archiveTarget.id)");
    expect(source).toContain("restoreExerciseAction(editing.id)");
    expect(source).toContain("Las sesiones y registros anteriores siempre se conservan.");
  });
});
