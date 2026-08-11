import { describe, expect, it } from "vitest";
import { todayInCordoba } from "./cordoba-date";
import {
  getInitialWorkoutSelection,
  getRoutineStartMeta,
  getWorkoutStartCtaLabel,
  toWorkoutStartActiveSession,
  type WorkoutStartRoutine,
} from "./workout-start";

const routines: WorkoutStartRoutine[] = [
  { id: "push", name: "PUSH", color: "#8b5cf6", exerciseCount: 9, setCount: 25 },
  { id: "pull", name: "PULL", color: null, exerciseCount: 1, setCount: 1 },
];

describe("selector de inicio de entrenamiento", () => {
  it("no preselecciona la primera rutina", () => {
    expect(getInitialWorkoutSelection(routines)).toBeNull();
    expect(getWorkoutStartCtaLabel(null, routines)).toBe("Elegí una opción");
  });

  it("preselecciona una rutina válida y actualiza el CTA", () => {
    const selection = getInitialWorkoutSelection(routines, "push");
    expect(selection).toEqual({ kind: "routine", routineId: "push" });
    expect(getWorkoutStartCtaLabel(selection, routines)).toBe("Empezar PUSH");
  });

  it("ignora una preselección que no está disponible", () => {
    expect(getInitialWorkoutSelection(routines, "archived")).toBeNull();
  });

  it("mantiene la sesión libre disponible sin rutinas", () => {
    expect(getWorkoutStartCtaLabel({ kind: "free" }, [])).toBe(
      "Empezar sesión libre",
    );
  });

  it("usa gramática singular y plural en los conteos", () => {
    expect(getRoutineStartMeta(routines[0])).toBe("9 ejercicios · 25 series");
    expect(getRoutineStartMeta(routines[1])).toBe("1 ejercicio · 1 serie");
  });

  it("resume una sesión activa con el nombre de la rutina", () => {
    expect(
      toWorkoutStartActiveSession({
        session: {
          id: "session-1",
          session_name: null,
          routine_name_snapshot: "PUSH",
        },
        log_date: "2026-08-11",
      }),
    ).toEqual({ id: "session-1", name: "PUSH", logDate: "2026-08-11" });
  });
});

describe("fecha de Córdoba", () => {
  it("usa el nuevo día local aunque UTC todavía esté en el día anterior", () => {
    expect(todayInCordoba(new Date("2026-08-12T02:30:00.000Z"))).toBe("2026-08-11");
  });

  it("cambia de fecha al cruzar medianoche en Córdoba", () => {
    expect(todayInCordoba(new Date("2026-08-12T03:01:00.000Z"))).toBe("2026-08-12");
  });
});
