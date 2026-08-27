import { describe, expect, it } from "vitest";
import {
  LEGACY_ROUTINE_COLOR_TO_KEY,
  ROUTINE_COLOR_KEYS,
  ROUTINE_COLOR_PRESETS,
  assertRoutineColor,
  normalizeLegacyRoutineColor,
  resolveRoutineColor,
  routineColorCssVariable,
} from "./routine-colors";

describe("routine colors", () => {
  it("defines the complete selectable palette without destructive red", () => {
    expect(ROUTINE_COLOR_KEYS).toEqual([
      "violet", "indigo", "blue", "cyan", "green", "yellow", "orange", "rose",
    ]);
    expect(ROUTINE_COLOR_KEYS).not.toContain("red");
    expect(ROUTINE_COLOR_KEYS).toContain("rose");
    expect(ROUTINE_COLOR_PRESETS.every((preset) => Boolean(preset.label) && Boolean(preset.cssVariable))).toBe(true);
  });

  it("uses violet only as a visual fallback for null or invalid legacy input", () => {
    expect(resolveRoutineColor(null)).toBe("violet");
    expect(resolveRoutineColor("#ef4444")).toBe("violet");
    expect(routineColorCssVariable(null)).toBe("var(--routine-violet)");
  });

  it("validates persisted values strictly", () => {
    expect(assertRoutineColor("indigo")).toBe("indigo");
    expect(assertRoutineColor(null)).toBeNull();
    expect(() => assertRoutineColor("#3b82f6")).toThrow("color de rutina válido");
    expect(() => assertRoutineColor("red")).toThrow("color de rutina válido");
  });

  it("maps every supported legacy hex deterministically and preserves null", () => {
    expect(LEGACY_ROUTINE_COLOR_TO_KEY).toEqual({
      "#a855f7": "violet",
      "#3b82f6": "blue",
      "#06b6d4": "cyan",
      "#22c55e": "green",
      "#eab308": "yellow",
      "#f97316": "orange",
      "#ef4444": "rose",
    });
    expect(normalizeLegacyRoutineColor(null)).toBeNull();
  });
});
