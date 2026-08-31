import { describe, expect, it } from "vitest";
import {
  exerciseGroupLabel,
  exerciseLibrarySummary,
  filterExerciseLibrary,
  groupExerciseLibrary,
  normalizeExerciseSearch,
  sortExerciseLibrary,
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
    implement: null,
    weight_mode: null,
    series_sugeridas: null,
    reps_sugeridas: null,
    peso_sugerido: null,
    rir_sugerido: null,
    descanso_min_sugerido_segundos: null,
    descanso_max_sugerido_segundos: null,
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

  it("normaliza acentos y espacios al buscar por nombre", () => {
    const accentEntries = [
      exercise("CURL BÍCEPS"),
      exercise("Press   inclinado"),
    ];

    expect(filterExerciseLibrary(accentEntries, { query: "biceps", group: "all" })).toEqual([
      accentEntries[0],
    ]);
    expect(filterExerciseLibrary(accentEntries, { query: "press inclinado", group: "all" })).toEqual([
      accentEntries[1],
    ]);
    expect(normalizeExerciseSearch("  BíCEPS   ")).toBe("biceps");
  });

  it("busca por identidad útil ya cargada", () => {
    const identityEntries = [
      exercise("JALÓN NEUTRO", {
        grupo_muscular: "espalda",
        muscle_group_label: "Dorsal ancho",
        implement: "Polea",
        weight_mode: "Peso total",
      }),
      exercise("PRESS MANCUERNAS", {
        grupo_muscular: "pecho",
        implement: "Mancuernas",
        weight_mode: "Por mancuerna",
      }),
    ];

    expect(filterExerciseLibrary(identityEntries, { query: "polea", group: "all" })).toEqual([
      identityEntries[0],
    ]);
    expect(filterExerciseLibrary(identityEntries, { query: "dorsal", group: "all" })).toEqual([
      identityEntries[0],
    ]);
    expect(filterExerciseLibrary(identityEntries, { query: "espalda", group: "all" })).toEqual([
      identityEntries[0],
    ]);
    expect(filterExerciseLibrary(identityEntries, { query: "por mancuerna", group: "all" })).toEqual([
      identityEntries[1],
    ]);
  });

  it("filtra por grupo, sin grupo y todos", () => {
    expect(filterExerciseLibrary(entries, { query: "", group: "espalda" })).toHaveLength(2);
    expect(filterExerciseLibrary(entries, { query: "", group: "none" }).map((item) => item.id)).toEqual(["Movilidad"]);
    expect(filterExerciseLibrary(entries, { query: "", group: "all" })).toHaveLength(4);
  });

  it("devuelve vacío cuando no hay coincidencias", () => {
    expect(filterExerciseLibrary(entries, { query: "sentadilla", group: "all" })).toEqual([]);
  });

  it("combina búsqueda y grupo", () => {
    expect(filterExerciseLibrary(entries, { query: "remo", group: "espalda" })).toHaveLength(2);
    expect(filterExerciseLibrary(entries, { query: "remo", group: "cardio" })).toEqual([]);
  });
});

describe("exercise library presentation helpers", () => {
  it("ordena resultados alfabéticamente y agrupa por el grupo canónico", () => {
    const grouped = groupExerciseLibrary([
      exercise("REMO T", { grupo_muscular: "espalda" }),
      exercise("APERTURAS", { grupo_muscular: "pecho" }),
      exercise("JALÓN", { grupo_muscular: "espalda" }),
      exercise("MOVILIDAD"),
    ]);

    expect(grouped.map((section) => section.label)).toEqual(["Pecho", "Espalda", "Sin grupo"]);
    expect(grouped[1]?.exercises.map((item) => item.nombre)).toEqual(["JALÓN", "REMO T"]);
    expect(sortExerciseLibrary([exercise("Z"), exercise("A")]).map((item) => item.nombre)).toEqual([
      "A",
      "Z",
    ]);
  });
});

describe("exerciseLibrarySummary", () => {
  it("prioriza la identidad del ejercicio sobre valores sugeridos", () => {
    expect(exerciseLibrarySummary(exercise("CINTA", { grupo_muscular: "cardio" }))).toBe("Cardio");
    expect(exerciseLibrarySummary(exercise("Press", {
      grupo_muscular: "pecho",
      muscle_group_label: "Pectoral superior",
      implement: "Mancuernas",
      weight_mode: "Por mancuerna",
      series_sugeridas: 3,
      reps_sugeridas: 10,
      peso_sugerido: 80,
      rir_sugerido: 2,
      descanso_min_sugerido_segundos: 120,
      descanso_max_sugerido_segundos: 180,
    }))).toBe("Pectoral superior · Mancuernas · Por mancuerna");
  });

  it("usa el label canónico cuando falta el detalle específico", () => {
    expect(exerciseGroupLabel(exercise("REMO", { grupo_muscular: "espalda" }))).toBe("Espalda");
    expect(exerciseGroupLabel(exercise("POSTERIORES", {
      grupo_muscular: "hombros",
      muscle_group_label: "Deltoides posteriores",
    }))).toBe("Deltoides posteriores");
    expect(exerciseLibrarySummary(exercise("REMO", { grupo_muscular: "espalda" }))).toBe("Espalda");
  });
});
