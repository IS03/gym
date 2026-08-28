import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(
  "src/app/(app)/train/session/[id]/session-editor.tsx",
  "utf8",
);
const addExerciseSheet = readFileSync(
  "src/app/(app)/train/session/[id]/add-exercise-sheet.tsx",
  "utf8",
);

describe("PR 14 — interacción de sesión", () => {
  it("ancla la card con layout effect y compensación, sin scrollIntoView", () => {
    expect(editor).toContain("useLayoutEffect");
    expect(editor).toContain("pendingScrollAnchorRef");
    expect(editor).toContain("calculateScrollCompensation");
    expect(editor).toContain("window.scrollBy(0, delta)");
    expect(editor).not.toContain("scrollIntoView");
  });

  it("mantiene un solo ejercicio abierto y guarda el anterior al cambiar", () => {
    expect(editor).toContain(
      "setExpandedExerciseId((current) => (current === exerciseId ? null : exerciseId))",
    );
    expect(editor).toContain("autosaveRef.current?.flush(previouslyExpanded)");
    expect(editor).toContain('aria-expanded={expanded}');
    expect(editor).toContain('aria-controls={exerciseContentId}');
  });

  it("mantiene una nota breve arriba de las series sólo cuando tiene contenido", () => {
    expect(editor).toContain("const quickNote = payload.notes.trim()");
    expect(editor).toContain("{quickNote ? (");
    expect(editor).toContain("line-clamp-2");
    expect(editor).toContain("Nota para próximas sesiones");
    expect(editor).toContain("Nota del ejercicio en esta sesión");
  });

  it("usa un slot fijo para estados normales y reserva la recuperación para errores", () => {
    expect(editor).toContain("compactAutosaveStatus");
    expect(editor).toContain('"flex size-5 shrink-0 items-center justify-center"');
    expect(editor).not.toContain("Guardando…");
    expect(editor).not.toContain("Cambios locales");
    expect(editor).toContain("!readOnly && status?.error");
    expect(editor).toContain("Usar versión guardada");
    expect(editor).toContain("Reintentar");
    expect(editor).toContain("Actualizar");
  });

  it("usa un único indicador para recordatorios y actualización de targets", () => {
    expect(editor).toContain("hasFutureExerciseAction(payload.decision, payload.apply_to_routine)");
    expect(editor).toContain("Usar lo realizado hoy como nuevo objetivo");
    expect(editor).toContain("Al finalizar, sólo toma las series completadas.");
  });

  it("deja la nota en lectura compacta hasta que se solicita editar", () => {
    expect(editor).toContain("editingNoteExerciseId");
    expect(editor).toContain('{noteEditorOpen ? "Listo" : quickNote ? "Editar" : "Agregar"}');
    expect(editor).toContain('{quickNote || "Sin nota"}');
    expect(editor).toContain("noteEditorOpen ? (");
    expect(editor).toContain('className="min-h-20 w-full rounded-lg border bg-background');
  });

  it("muestra próxima vez en el flujo principal sin otra card o accordion", () => {
    expect(editor).toContain('<Label>Próxima vez</Label>');
    expect(editor).not.toContain("Progresión y próxima vez");
    expect(editor).toContain('aria-label="Decisión para la próxima vez"');
    expect(editor).toContain("hasFutureExerciseAction(payload.decision, payload.apply_to_routine)");
  });

  it("mantiene cancelar detrás del disclosure destructivo", () => {
    expect(editor).toContain("Más opciones");
    expect(editor).toContain("bg-destructive/80");
    expect(editor).toContain('variant="destructive"');
    expect(editor).toContain("Cancelar entrenamiento");
  });
});

describe("PR25 — selector estable de ejercicios", () => {
  it("usa altura estable y reserva el scroll al área de resultados", () => {
    expect(addExerciseSheet).toContain("h-[min(82dvh,44rem)]");
    expect(addExerciseSheet).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(addExerciseSheet).toContain("shrink-0 border-t");
    expect(addExerciseSheet).not.toContain("max-h-[42dvh]");
  });

  it("no reemplaza la selección al cambiar búsqueda o filtro", () => {
    expect(addExerciseSheet).toContain("selectedExerciseId === exercise.id");
    expect(addExerciseSheet).toContain("Seleccionado:");
    expect(editor).not.toContain("filteredLibraryExercises[0]");
    expect(editor).not.toContain("setSelectedExerciseId(\"\")");
  });

  it("separa selección suave de CTA primaria y expone estado accesible", () => {
    expect(addExerciseSheet).toContain('aria-pressed={selected}');
    expect(addExerciseSheet).toContain("bg-primary/[0.07]");
    expect(addExerciseSheet).toContain("Agregar a la sesión");
    expect(addExerciseSheet).toContain("disabled={!selectedExercise || pending}");
  });

  it("mantiene la geometría y la salida secundaria al crear", () => {
    expect(addExerciseSheet).toContain("No hay ejercicios disponibles");
    expect(addExerciseSheet).toContain("Crear ejercicio nuevo");
    expect(addExerciseSheet).toContain("SessionCreateExerciseForm");
  });
});
