import { describe, it, expect } from "vitest";
import { appendNumericSessionFields, toNullableNumber } from "./session-exercise-autosave-helpers";

describe("toNullableNumber", () => {
  it("devuelve null con vacío o blancos", () => {
    expect(toNullableNumber("")).toBeNull();
    expect(toNullableNumber("  ")).toBeNull();
  });
  it("parsee enteros y decimales", () => {
    expect(toNullableNumber("3")).toBe(3);
    expect(toNullableNumber("12.5")).toBe(12.5);
  });
  it("devuelve null si no es número", () => {
    expect(toNullableNumber("x")).toBeNull();
  });
});

describe("appendNumericSessionFields", () => {
  it("incluye siempre las claves; vacío → limpiar (numOptional en servidor)", () => {
    const fd = new FormData();
    appendNumericSessionFields(fd, "3", "10", "");
    expect(fd.get("series_reales")).toBe("3");
    expect(fd.get("reps_reales")).toBe("10");
    expect(fd.get("peso_real")).toBe("");
  });
  it("vacíos limpian todo", () => {
    const fd = new FormData();
    appendNumericSessionFields(fd, "", "", "");
    expect(fd.get("series_reales")).toBe("");
    expect(fd.get("reps_reales")).toBe("");
    expect(fd.get("peso_real")).toBe("");
  });
});
