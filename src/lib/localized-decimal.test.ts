import { describe, expect, it } from "vitest";
import {
  formatLocalizedDecimal,
  isLocalizedDecimalDraft,
  parseLocalizedDecimal,
} from "./localized-decimal";

describe("localized decimal input", () => {
  it.each([
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["0,25", 0.25],
    ["0.25", 0.25],
  ])("parses %s", (raw, expected) => {
    expect(parseLocalizedDecimal(raw)).toBe(expected);
  });

  it("keeps the trailing separator as editable text until the next digit", () => {
    expect(isLocalizedDecimalDraft("12,")).toBe(true);
    expect(parseLocalizedDecimal("12,")).toBeNull();
    expect(parseLocalizedDecimal("12,5")).toBe(12.5);
    expect(formatLocalizedDecimal(12.5)).toBe("12,5");
  });

  it.each(["12,5,2", "12.5.2", "1.234,56", "1,234.56", "abc", "1e3", "12,345"])(
    "rejects ambiguous or unsupported %s",
    (raw) => {
      expect(isLocalizedDecimalDraft(raw)).toBe(false);
      expect(parseLocalizedDecimal(raw)).toBeNull();
    },
  );

  it("allows an optional empty value", () => {
    expect(parseLocalizedDecimal("")).toBeNull();
  });
});
