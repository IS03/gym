import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/phase2/training.ts", "utf8");

describe("días entrenados del mes", () => {
  it("consulta en bloque sólo sesiones terminadas del rango mensual", () => {
    expect(source).toContain('.from("workout_sessions")');
    expect(source).toContain('.eq("status", "completed")');
    expect(source).toContain('.not("ended_at", "is", null)');
    expect(source).toContain('.gte("day_logs.log_date", start)');
    expect(source).toContain('.lt("day_logs.log_date", end)');
  });

  it("adapta las filas una sola vez al agrupador canónico", () => {
    expect(source).toContain("const records = ((data ?? []) as TrainingDayQueryRow[]).flatMap");
    expect(source).toContain("return groupTrainingDays(records)");
  });
});
