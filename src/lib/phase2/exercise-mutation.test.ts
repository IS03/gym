import { describe, expect, it } from "vitest";
import { normalizeExerciseMutation } from "./exercise-mutation";

describe("normalizeExerciseMutation", () => {
  it("normaliza un ejercicio válido y conserva los valores sugeridos", () => {
    expect(normalizeExerciseMutation({
      nombre: "  Press banca  ",
      grupo_muscular: "pecho",
      series_sugeridas: 3,
      reps_sugeridas: 10,
      peso_sugerido: 80,
    })).toEqual({
      nombre: "Press banca",
      grupo_muscular: "pecho",
      series_sugeridas: 3,
      reps_sugeridas: 10,
      peso_sugerido: 80,
    });
  });

  it("permite un ejercicio sin grupo ni valores sugeridos", () => {
    expect(normalizeExerciseMutation({
      nombre: "Cinta",
      grupo_muscular: null,
      series_sugeridas: null,
      reps_sugeridas: null,
      peso_sugerido: null,
    })).toMatchObject({ nombre: "Cinta", grupo_muscular: null });
  });

  it("rechaza nombre, grupo y valores inválidos antes de tocar la base", () => {
    expect(() => normalizeExerciseMutation({ nombre: "", grupo_muscular: null })).toThrow("Nombre es obligatorio");
    expect(() => normalizeExerciseMutation({ nombre: "Press", grupo_muscular: "cuello" })).toThrow("Grupo muscular inválido");
    expect(() => normalizeExerciseMutation({ nombre: "Press", grupo_muscular: "pecho", series_sugeridas: -1 })).toThrow("Series sugeridas");
  });
});
