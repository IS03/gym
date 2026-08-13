import { describe, expect, it } from "vitest";
import {
  exerciseLibrarySummary,
  filterExerciseLibrary,
  type ExerciseLibraryItem,
} from "./exercise-library";

function exercise(
  id: string,
  overrides: Partial<ExerciseLibraryItem> = {},
): ExerciseLibraryItem {
  return {
    id,
    nombre: id,
    grupo_muscular: null,
    muscle_group_label: null,
    series_sugeridas: null,
    reps_sugeridas: null,
    peso_sugerido: null,
    updated_at: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

const entries = [
  exercise("REMO T", { grupo_muscular: "espalda" }),
  exercise("Remo pecho apoyado", { grupo_muscular: "espalda" }),
  exercise("Cinta · Express", { grupo_muscular: "cardio" }),
  exercise("Movilidad"),
];

describe("filterExerciseLibrary", () => {
  it("encuentra coincidencias exactas y parciales sin distinguir mayúsculas", () => {
    expect(filterExerciseLibrary(entries, { query: "remo", group: "all" }).map((item) => item.id)).toEqual([
      "REMO T",
      "Remo pecho apoyado",
    ]);
    expect(filterExerciseLibrary(entries, { query: "REMO T", group: "all" }).map((item) => item.id)).toEqual(["REMO T"]);
  });

  it("filtra por grupo, sin grupo y todos", () => {
    expect(filterExerciseLibrary(entries, { query: "", group: "espalda" })).toHaveLength(2);
    expect(filterExerciseLibrary(entries, { query: "", group: "none" }).map((item) => item.id)).toEqual(["Movilidad"]);
    expect(filterExerciseLibrary(entries, { query: "", group: "all" })).toHaveLength(4);
  });

  it("devuelve vacío cuando no hay coincidencias", () => {
    expect(filterExerciseLibrary(entries, { query: "sentadilla", group: "all" })).toEqual([]);
  });
});

describe("exerciseLibrarySummary", () => {
  it("muestra solamente valores útiles y no rompe ejercicios cardio", () => {
    expect(exerciseLibrarySummary(exercise("CINTA", { grupo_muscular: "cardio" }))).toBe("Cardio");
    expect(exerciseLibrarySummary(exercise("Press", {
      grupo_muscular: "pecho",
      series_sugeridas: 3,
      reps_sugeridas: 10,
      peso_sugerido: 80,
    }))).toBe("Pecho · 3×10 · 80 kg");
  });
});
