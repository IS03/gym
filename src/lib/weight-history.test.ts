import { describe, expect, it } from "vitest";
import {
  formatWeightKg,
  parseOptionalWeight,
  shouldRecordCurrentWeight,
  weightChange,
  weightHistoryForLastDays,
  type WeightHistoryPoint,
} from "./weight-history";

const entries: WeightHistoryPoint[] = [
  { id: "one", log_date: "2026-05-01", weight_kg: 66 },
  { id: "two", log_date: "2026-08-01", weight_kg: 65.4 },
  { id: "three", log_date: "2026-08-11", weight_kg: 64.8 },
];

describe("historial de peso", () => {
  it("acepta decimales con punto o coma y rechaza valores inválidos", () => {
    expect(parseOptionalWeight("64.8")).toEqual({ ok: true, value: 64.8 });
    expect(parseOptionalWeight("64,8")).toEqual({ ok: true, value: 64.8 });
    expect(parseOptionalWeight("")).toEqual({ ok: true, value: null });
    expect(parseOptionalWeight("NaN").ok).toBe(false);
    expect(parseOptionalWeight("-1").ok).toBe(false);
    expect(parseOptionalWeight("1000").ok).toBe(false);
    expect(parseOptionalWeight("64.888").ok).toBe(false);
  });

  it("usa sólo puntos reales del período y calcula el cambio de forma neutral", () => {
    expect(weightHistoryForLastDays(entries, "2026-08-11", 90).map((entry) => entry.id)).toEqual([
      "two",
      "three",
    ]);
    expect(weightChange(entries.slice(1))).toBeCloseTo(-0.6);
    expect(weightChange([entries[2]!])).toBeNull();
  });

  it("formatea el peso para la interfaz argentina", () => {
    expect(formatWeightKg(64.8)).toBe("64,8");
  });

  it("sólo crea o reemplaza el snapshot diario cuando el peso actual cambia", () => {
    expect(shouldRecordCurrentWeight(null, 65)).toBe(true);
    expect(shouldRecordCurrentWeight(65, 64.8)).toBe(true);
    expect(shouldRecordCurrentWeight(64.8, 64.8)).toBe(false);
    expect(shouldRecordCurrentWeight(64.8, null)).toBe(false);
  });
});
