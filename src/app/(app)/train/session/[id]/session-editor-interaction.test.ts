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

  it("compacta el guardado limpio y conserva la recuperación cuando hay error", () => {
    expect(editor).toContain("!readOnly && (dirty || status?.pending || status?.error)");
    expect(editor).toContain('aria-label="Guardado"');
    expect(editor).toContain("Usar versión guardada");
    expect(editor).toContain("Reintentar");
    expect(editor).toContain("Actualizar");
  });

  it("usa un único indicador para recordatorios y actualización de targets", () => {
    expect(editor).toContain("hasFutureExerciseAction(payload.decision, payload.apply_to_routine)");
    expect(editor).toContain("Guardar lo realizado como nuevo objetivo");
  });
});
