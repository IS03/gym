import { describe, expect, it } from "vitest";
import { buildRoutineOverviews, type RoutineOverviewSourceRow } from "./routine-overview";

describe("buildRoutineOverviews", () => {
  it("agrega ejercicios, series y músculos sin mezclar rutinas", () => {
    const rows: RoutineOverviewSourceRow[] = [
      {
        routine_id: "push",
        exercise: { nombre: "Press banca", grupo_muscular: "pecho", muscle_group_label: "Pectoral" },
        sets: [{ id: "1" }, { id: "2" }, { id: "3" }],
      },
      {
        routine_id: "push",
        exercise: [{ nombre: "Press militar", grupo_muscular: "hombros", muscle_group_label: null }],
        sets: [{ id: "4" }, { id: "5" }],
      },
      {
        routine_id: "pull",
        exercise: { nombre: "Jalón", grupo_muscular: "espalda", muscle_group_label: null },
        sets: { id: "6" },
      },
    ];

    const result = buildRoutineOverviews(["push", "pull"], rows);

    expect(result.get("push")).toEqual({
      exerciseCount: 2,
      setCount: 5,
      exerciseNames: ["Press banca", "Press militar"],
      muscleGroups: ["Pectoral", "Hombros"],
    });
    expect(result.get("pull")?.setCount).toBe(1);
  });

  it("conserva rutinas vacías e ignora filas ajenas", () => {
    const result = buildRoutineOverviews(
      ["legs"],
      [{ routine_id: "otra", exercise: null, sets: null }],
    );

    expect(result.get("legs")).toEqual({
      exerciseCount: 0,
      setCount: 0,
      exerciseNames: [],
      muscleGroups: [],
    });
    expect(result.has("otra")).toBe(false);
  });
});
