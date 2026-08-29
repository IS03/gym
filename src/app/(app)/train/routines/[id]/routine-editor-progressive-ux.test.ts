import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/train/routines/[id]/page.tsx");
const manager = source("src/app/(app)/train/routines/[id]/routine-exercise-manager.tsx");
const editor = source("src/app/(app)/train/routines/[id]/routine-template-editor.tsx");
const shell = source("src/app/(app)/train/routines/[id]/routine-editor-shell.tsx");
const calendar = source("src/app/(app)/train/calendar/page.tsx");
const filters = source("src/app/(app)/train/calendar/calendar-filters.tsx");

describe("PR 10.6 — divulgación progresiva de entrenamiento", () => {
  it("mantiene Agregar ejercicio bajo demanda con búsqueda, filtros y geometría estable", () => {
    expect(page).toContain("RoutineEditorShell");
    expect(manager).toContain("addExerciseToRoutineAction");
    expect(manager).toContain('h-[min(82dvh,44rem)]');
    expect(manager).toContain("Buscar ejercicio");
    expect(manager).toContain("MUSCLE_GROUP_OPTIONS");
    expect(manager).toContain("filterRoutinePickerExercises");
    expect(manager).toContain("Agregar a la rutina");
  });

  it("mantiene un solo ejercicio abierto y conserva dirty/save/reorder/remove", () => {
    expect(editor).toContain("useState<string | null>");
    expect(editor).toContain("nextExpandedRoutineExerciseId");
    expect(editor).toContain("aria-expanded={isOpen}");
    expect(editor).toContain("aria-controls={contentId}");
    expect(editor).toContain("Sin guardar");
    expect(editor).toContain("saveRoutineExerciseTargetAction");
    expect(editor).toContain("moveRoutineExerciseTargetAction");
    expect(editor).toContain("removeRoutineExerciseAction");
    expect(editor).toContain("Guardá los objetivos pendientes antes de cambiar la estructura de la rutina.");
    expect(editor).not.toContain("window.confirm");
  });

  it("bloquea operaciones estructurales e inicio mientras existen cambios locales", () => {
    expect(shell).toContain("Guardalos antes de cambiar la estructura o iniciar una sesión.");
    expect(shell).toContain("disabled={!canChangeStructure()}");
    expect(shell).toContain("Tenés cambios sin guardar");
    expect(shell).toContain("Salir sin guardar");
  });

  it("pone el calendario antes que filtros y preserva el filtro al navegar", () => {
    expect(calendar).toContain("trainingCalendarHref(addMonths(month, -1), routineId)");
    expect(calendar).toContain("trainingCalendarHref(addMonths(month, 1), routineId)");
    expect(calendar).toContain("buildMonthGrid(month, { full: true })");
    expect(calendar).toContain("listTrainingDaysInMonth");
    expect(filters).toContain('type="month"');
    expect(filters).toContain("Todas las rutinas");
    expect(filters).toContain("Filtros · ${activeName}");
  });
});
