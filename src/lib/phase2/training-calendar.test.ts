import { describe, expect, it } from "vitest";
import { addMonths, buildMonthGrid, formatMonthLabel } from "./training-calendar";

describe("calendario de entrenamiento", () => {
  it("arma sólo las semanas necesarias y empieza en lunes", () => {
    const days = buildMonthGrid("2026-08");

    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({ date: "2026-07-27", inMonth: false });
    expect(days.at(-1)).toEqual({ date: "2026-09-06", inMonth: false });
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
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
});
