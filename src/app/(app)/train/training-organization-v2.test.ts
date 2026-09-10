import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const hub = source("src/app/(app)/train/page.tsx");
const preview = source("src/components/training/training-month-preview.tsx");
const dedicatedCalendar = source("src/app/(app)/train/calendar/page.tsx");
const day = source("src/app/(app)/train/day/page.tsx");
const routines = source("src/app/(app)/train/routines/page.tsx");
const routineDetail = source("src/app/(app)/train/routines/[id]/routine-editor-shell.tsx");
const archivedRoutines = source("src/app/(app)/train/routines/archived-routines.tsx");
const library = source("src/app/(app)/train/exercises/exercise-library.tsx");

describe("PR76 — Entrenar y organización V2", () => {
  it("conserva la acción principal y las tres rutas operativas del hub", () => {
    expect(hub).toContain("Nueva sesión");
    expect(hub).toContain('href="/train/routines"');
    expect(hub).toContain('href="/train/exercises"');
    expect(hub).toContain('href="/train/history"');
  });

  it("hace del mini calendario un acceso directo al detalle de cualquier fecha pasada", () => {
    expect(preview).toContain('trainingDayHref(day.date, { source: "train" })');
    expect(preview).toContain("const trained = colors.length > 0");
    expect(preview).toContain("trainedDays.get(day.date) ?? []");
    expect(preview).not.toContain("/train/calendar?month=");
    expect(preview).not.toContain("Constancia del mes");
  });

  it("preserva la ruta dedicada como deep link y el detalle real con múltiples sesiones", () => {
    expect(dedicatedCalendar).toContain("trainingCalendarHref(addMonths(month, -1), routineId)");
    expect(dedicatedCalendar).toContain("trainingDayHref(entry.date, { routineId: routineId || null })");
    expect(day).toContain("listCompletedSessionHistory({ logDate: date, limit: 100 })");
    expect(day).toContain("sessions.map((session, index)");
    expect(day).toContain("trainingDayReturnTarget(date, routineId || null, source)");
  });

  it("agrupa rutinas activas en rows y desplaza Archivar al detalle", () => {
    expect(routines).toContain("overflow-hidden rounded-xl border border-border/80 bg-card");
    expect(routines).toContain("routineColorCssVariable(routine.color)");
    expect(routines).toContain("border-t border-border/70");
    expect(routines).not.toContain("RoutineArchiveButton");
    expect(routineDetail).toContain("Opciones de rutina");
    expect(routineDetail).toContain('trigger="secondary"');
    expect(archivedRoutines).toContain("RoutineRestoreButton");
  });

  it("reutiliza el inicio canónico desde el detalle sin duplicar lógica en la lista", () => {
    expect(routineDetail).toContain('href={`/train/session/new?routine_id=${routine.id}`}');
    expect(routines).not.toContain("/train/session/new?routine_id=");
  });

  it("mantiene Biblioteca como colección descriptiva agrupada con búsqueda y filtro muscular", () => {
    expect(library).toContain('placeholder="Buscar ejercicio"');
    expect(library).toContain("GROUP_FILTER_OPTIONS");
    expect(library).toContain("groupExerciseLibrary(visibleExercises)");
    expect(library).toContain("divide-y divide-border/70");
    expect(library).toContain("exerciseLibrarySummary(exercise)");
    expect(library).toContain("onClick={() => onEdit(exercise)}");
    expect(library).not.toContain("último peso");
    expect(library).not.toContain("récord");
  });
});
