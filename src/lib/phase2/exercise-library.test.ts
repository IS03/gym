import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXERCISE_LIBRARY_FILTERS,
  diffRoutineMemberships,
  exerciseLibraryActiveFilterCount,
  exerciseLibrarySummary,
  filterExerciseLibrary,
  groupExerciseLibrary,
  normalizeExerciseSearch,
  type ExerciseLibraryFilters,
  type ExerciseLibraryItem,
} from "./exercise-library";

function exercise(id: string, overrides: Partial<ExerciseLibraryItem> = {}): ExerciseLibraryItem {
  return { id, nombre: id, grupo_muscular: null, muscle_group_label: null, implement: null, weight_mode: null,
    series_sugeridas: null, reps_sugeridas: null, peso_sugerido: null, rir_sugerido: null,
    descanso_min_sugerido_segundos: null, descanso_max_sugerido_segundos: null, notes: null,
    is_active: true, updated_at: "2026-09-10T00:00:00.000Z", memberships: [], ...overrides };
}

const filters = (overrides: Partial<ExerciseLibraryFilters> = {}): ExerciseLibraryFilters => ({
  ...DEFAULT_EXERCISE_LIBRARY_FILTERS, ...overrides,
});
const entries = [
  exercise("PRESS", { grupo_muscular: "pecho", muscle_group_label: "Pectoral mayor", implement: "Mancuernas", memberships: [{ id: "push", nombre: "PUSH", color: "rose" }] }),
  exercise("APERTURAS", { grupo_muscular: "pecho", implement: "Máquina", memberships: [{ id: "upper", nombre: "UPPER", color: "blue" }] }),
  exercise("REMO", { grupo_muscular: "espalda", implement: "Máquina", memberships: [{ id: "pull", nombre: "PULL", color: "blue" }] }),
  exercise("MOVILIDAD", { implement: "Banda" }),
  exercise("LEGACY", { grupo_muscular: "piernas", implement: "Barra", is_active: false }),
];

describe("filterExerciseLibrary", () => {
  it("busca en vivo por nombre, grupo, detalle, implemento y carga sin acentos", () => {
    expect(filterExerciseLibrary(entries, { query: "pectoral", filters: filters() }).map((item) => item.id)).toEqual(["PRESS"]);
    expect(filterExerciseLibrary(entries, { query: "maquina", filters: filters() }).map((item) => item.id)).toEqual(["APERTURAS", "REMO"]);
    expect(normalizeExerciseSearch("  BÍceps ")).toBe("biceps");
  });

  it("aplica OR dentro de rutina, grupo e implemento", () => {
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ routineIds: ["push", "pull"] }) }).map((item) => item.id)).toEqual(["PRESS", "REMO"]);
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ muscleGroups: ["pecho", "espalda"] }) })).toHaveLength(3);
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ implements: ["Máquina", "Mancuernas"] }) })).toHaveLength(3);
  });

  it("aplica AND entre categorías y combina búsqueda", () => {
    expect(filterExerciseLibrary(entries, { query: "press", filters: filters({ routineIds: ["push", "pull"], muscleGroups: ["pecho"], implements: ["Mancuernas"] }) }).map((item) => item.id)).toEqual(["PRESS"]);
    expect(filterExerciseLibrary(entries, { query: "remo", filters: filters({ routineIds: ["push"] }) })).toEqual([]);
  });

  it("resuelve Sin rutina con implemento y estado Activos/Archivados/Todos", () => {
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ withoutRoutine: true, implements: ["Banda"] }) }).map((item) => item.id)).toEqual(["MOVILIDAD"]);
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ status: "archived" }) }).map((item) => item.id)).toEqual(["LEGACY"]);
    expect(filterExerciseLibrary(entries, { query: "", filters: filters({ status: "all" }) })).toHaveLength(5);
  });
});

describe("exercise library presentation", () => {
  it("agrupa sólo grupos visibles, ordena y cuenta el dataset filtrado", () => {
    const grouped = groupExerciseLibrary(filterExerciseLibrary(entries, { query: "", filters: filters({ implements: ["Máquina"] }) }));
    expect(grouped.map((group) => [group.label, group.exercises.length])).toEqual([["Pecho", 1], ["Espalda", 1]]);
  });
  it("omite el grupo ya conocido en el resumen compacto", () => {
    expect(exerciseLibrarySummary(entries[0])).toBe("Mancuernas");
    expect(exerciseLibrarySummary(exercise("VACÍO"))).toBe("Sin configuración");
  });
  it("cuenta únicamente filtros no-default", () => {
    expect(exerciseLibraryActiveFilterCount(filters())).toBe(0);
    expect(exerciseLibraryActiveFilterCount(filters({ routineIds: ["push"], muscleGroups: ["pecho"], status: "all" }))).toBe(3);
  });
  it("calcula altas y bajas de memberships sin duplicar", () => {
    expect(diffRoutineMemberships(["push", "pull"], ["pull", "legs"])).toEqual({ add: ["legs"], remove: ["push"] });
  });
});
