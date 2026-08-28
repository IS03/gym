import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(
  "src/app/(app)/train/session/[id]/session-editor.tsx",
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
});
