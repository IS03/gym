import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/train/routines/[id]/page.tsx");
const manager = source("src/app/(app)/train/routines/[id]/routine-exercise-manager.tsx");
const editor = source("src/app/(app)/train/routines/[id]/routine-template-editor.tsx");
const calendar = source("src/app/(app)/train/calendar/page.tsx");
const filters = source("src/app/(app)/train/calendar/calendar-filters.tsx");

describe("PR 10.6 — divulgación progresiva de entrenamiento", () => {
  it("mantiene Agregar ejercicio bajo demanda y usa la action existente", () => {
    expect(page).toContain("RoutineExerciseAddDialog");
    expect(page).not.toContain("RoutineExerciseAddForm");
    expect(manager).toContain("addExerciseToRoutineAction");
    expect(manager).toContain("<ResponsiveDialog");
    expect(manager).toContain("onSuccess={() => {");
    expect(manager).toContain("router.refresh()");
  });

  it("inicia los objetivos plegados y conserva dirty/save/reorder/remove", () => {
    expect(editor).toContain("useState<Record<string, boolean>>({})");
    expect(editor).toContain("aria-expanded={isOpen}");
    expect(editor).toContain("aria-controls={contentId}");
    expect(editor).toContain("Sin guardar");
    expect(editor).toContain("saveRoutineExerciseTargetAction");
    expect(editor).toContain("moveRoutineExerciseTargetAction");
    expect(editor).toContain("removeRoutineExerciseAction");
    expect(editor).toContain("Guardá los objetivos pendientes antes de cambiar el orden.");
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
