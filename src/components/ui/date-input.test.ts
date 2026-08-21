import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const dateInput = source("src/components/ui/date-input.tsx");
const input = source("src/components/ui/input.tsx");
const globals = source("src/app/globals.css");
const dateConsumers = [
  "src/app/(app)/today/create-meal-form.tsx",
  "src/app/(app)/today/page.tsx",
  "src/app/(app)/today/reports/page.tsx",
  "src/app/(app)/history/page.tsx",
  "src/app/(app)/settings/profile-form.tsx",
  "src/app/(app)/settings/nutrition/nutrition-settings-forms.tsx",
  "src/components/body/weight-history.tsx",
  "src/components/body/body-measurements.tsx",
].map(source);

describe("DateInput", () => {
  it("preserva type=date y centraliza la geometría anti-overflow", () => {
    expect(dateInput).toContain('type="date"');
    expect(input).toContain('type === "date"');
    expect(input).toContain("ownlevel-date-input");
    expect(input).toContain("[inline-size:100%]");
    expect(input).toContain("[max-inline-size:100%]");
    expect(input).toContain("[min-inline-size:0]");
  });

  it("acota sólo los pseudo-elementos WebKit necesarios", () => {
    expect(globals).toContain(".ownlevel-date-input::-webkit-date-and-time-value");
    expect(globals).toContain(".ownlevel-date-input::-webkit-datetime-edit");
    expect(globals).not.toContain(".ownlevel-date-input {\n  appearance");
  });

  it("migra los formularios de fecha reales a la misma primitiva", () => {
    for (const consumer of dateConsumers) {
      expect(consumer).toContain("DateInput");
      expect(consumer).not.toContain('type="date"');
    }
  });
});
