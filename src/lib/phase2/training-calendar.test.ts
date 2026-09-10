import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  formatMonthLabel,
  groupTrainingDays,
  trainingCalendarHref,
  trainingDayHref,
  trainingDayReturnTarget,
} from "./training-calendar";

describe("calendario de entrenamiento", () => {
  it("arma sólo las semanas necesarias y empieza en lunes", () => {
    const days = buildMonthGrid("2026-08");

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: "2026-07-27", inMonth: false });
    expect(days.at(-1)).toEqual({ date: "2026-09-06", inMonth: false });
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
  });

  it("preserva y limpia el filtro de rutina al navegar", () => {
    expect(trainingCalendarHref(addMonths("2026-08", -1), "push-id")).toBe("/train/calendar?month=2026-07&routine_id=push-id");
    expect(trainingCalendarHref(addMonths("2026-08", 1), "push-id")).toBe("/train/calendar?month=2026-09&routine_id=push-id");
    expect(trainingCalendarHref("2026-08", null)).toBe("/train/calendar?month=2026-08");
  });

  it("no agrega una sexta fila cuando el mes cabe en cinco", () => {
    const days = buildMonthGrid("2026-02");

    expect(days).toHaveLength(35);
    expect(days[0]?.date).toBe("2026-01-26");
    expect(days.at(-1)?.date).toBe("2026-03-01");
  });

  it("usa etiqueta humana y permite conservar el mes al navegar", () => {
    expect(formatMonthLabel("2026-08")).toBe("Agosto 2026");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("lleva una fecha del mini calendario directo al detalle y conserva su origen", () => {
    expect(trainingDayHref("2026-09-08", { source: "train" })).toBe(
      "/train/day?date=2026-09-08&from=train",
    );
    expect(trainingDayReturnTarget("2026-09-08", null, "train")).toEqual({
      href: "/train",
      label: "Entrenar",
    });
  });

  it("mantiene deep links del calendario dedicado y su filtro", () => {
    expect(trainingDayHref("2026-09-08", { routineId: "pull-id" })).toBe(
      "/train/day?date=2026-09-08&routine_id=pull-id",
    );
    expect(trainingDayReturnTarget("2026-09-08", "pull-id")).toEqual({
      href: "/train/calendar?month=2026-09&routine_id=pull-id",
      label: "Calendario",
    });
  });

  it("identifica sólo fechas con sesiones y preserva varias rutinas en el mismo día", () => {
    const days = groupTrainingDays([
      { date: "2026-09-08", color: "violet" },
      { date: "2026-09-08", color: "blue" },
      { date: "2026-09-08", color: "violet" },
    ]);

    expect(days.get("2026-09-08")).toEqual(["violet", "blue"]);
    expect(days.has("2026-09-09")).toBe(false);
  });
});
