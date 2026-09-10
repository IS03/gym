import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const shell = source("src/app/(app)/train/routines/[id]/routine-editor-shell.tsx");
const editor = source("src/app/(app)/train/routines/[id]/routine-template-editor.tsx");
const createForm = source("src/app/(app)/train/routines/routine-create-form.tsx");
const createSheet = source("src/app/(app)/train/routines/routine-create-sheet.tsx");

describe("PR78 — editor compacto de rutinas", () => {
  it("prioriza identidad, resumen e inicio de entrenamiento en el header", () => {
    expect(shell).toContain("routineColorCssVariable(routine.color)");
    expect(shell).toContain("items.length");
    expect(shell).toContain("setCount");
    expect(shell).toContain("Iniciar entrenamiento");
    expect(shell).toContain('aria-label="Editar nombre y color de la rutina"');
  });

  it("agrupa ejercicios en una colección compacta y mantiene uno abierto", () => {
    expect(editor).toContain("divide-y divide-border/70");
    expect(editor).toContain("nextExpandedRoutineExerciseId");
    expect(editor).toContain("aria-expanded={isOpen}");
    expect(editor).toContain("exerciseIdentityLabel");
    expect(editor).not.toContain("summarizeRoutineExerciseTarget");
  });

  it("centra número, contenido, chevron y menú sobre el mismo eje", () => {
    expect(editor).toContain("min-h-16 min-w-0 flex-1 items-center");
    expect(editor).toContain("flex size-7 shrink-0 items-center justify-center");
    expect(editor).toContain("size-4 shrink-0 text-muted-foreground");
    expect(editor).toContain("flex size-10 cursor-pointer");
    expect(editor).not.toContain("metric-number mt-0.5");
  });

  it("mantiene series editables con reps, peso y RIR centrados", () => {
    expect(editor).toContain("Repeticiones objetivo de serie");
    expect(editor).toContain("Peso objetivo de serie");
    expect(editor).toContain("RIR objetivo de serie");
    expect(editor.match(/text-center/g)?.length).toBeGreaterThanOrEqual(6);
    expect(editor).toContain("Agregar serie");
    expect(editor).toContain("Quitar serie");
  });

  it("expone mover y quitar junto al header sin enterrarlos al final", () => {
    expect(editor).toContain("Acciones de ${item.exercise.nombre}");
    expect(editor).toContain("Mover arriba");
    expect(editor).toContain("Mover abajo");
    expect(editor).toContain("Quitar de la rutina");
    expect(editor.indexOf("Acciones de ${item.exercise.nombre}")).toBeLessThan(
      editor.indexOf("id={contentId}"),
    );
    expect(editor).not.toContain("Más opciones");
  });

  it("preserva guardado explícito y protección de cambios locales", () => {
    expect(editor).toContain("saveRoutineExerciseTargetAction");
    expect(editor).toContain("Guardar cambios");
    expect(editor).toContain("Cambios sin guardar");
    expect(editor).toContain("Guardá los objetivos pendientes antes de cambiar la estructura de la rutina.");
    expect(shell).toContain("Tenés cambios sin guardar");
  });

  it("alinea crear rutina con el editor y ofrece un vacío accionable", () => {
    expect(createForm).toContain("routineColorCssVariable(color)");
    expect(createForm).toContain("RoutineColorPicker");
    expect(createSheet).toContain("Después vas a poder agregar y ordenar ejercicios.");
    expect(shell).toContain("Todavía no tiene ejercicios");
    expect(shell).toContain("Agregá el primero para empezar a armar esta rutina.");
    expect(shell).toContain("RoutineExerciseAddDialog");
  });

  it("usa acciones violetas suaves y conserva ambos flujos de agregado", () => {
    expect(editor).toContain("Agregar serie");
    expect(editor).toContain("bg-primary/10 text-primary hover:bg-primary/15");
    expect(shell).toContain("Agregar ejercicio");
    expect(shell).toContain("w-full max-w-xs border-primary/20 bg-primary/10");
  });
});
