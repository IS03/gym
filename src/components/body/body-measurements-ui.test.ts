import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/body/body-measurements.tsx", "utf8");

describe("PR 16 — UI de medidas corporales", () => {
  it("no presenta campos históricos como entradas nuevas", () => {
    expect(source).toContain("EDITABLE_BODY_MEASUREMENT_FIELDS.map");
    expect(source).not.toContain("(legacy)");
  });

  it("conserva valores históricos en el payload de edición", () => {
    expect(source).toContain("for(const field of BODY_MEASUREMENT_FIELDS)");
    expect(source).toContain("setValues(toValues(entry))");
  });
});
