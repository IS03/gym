import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { formatDateFieldValue } from "../../lib/date-field-display";

const source = (path: string) => readFileSync(path, "utf8");
const dateField = source("src/components/ui/date-field.tsx");
const input = source("src/components/ui/input.tsx");
const globals = source("src/app/globals.css");
const dateConsumers = [
  "src/app/(app)/today/create-meal-form.tsx",
  "src/app/(app)/today/page.tsx",
  "src/components/nutrition/nutrition-report-period-selector.tsx",
  "src/app/(app)/history/page.tsx",
  "src/app/(app)/settings/profile-form.tsx",
  "src/app/(app)/settings/nutrition/nutrition-settings-forms.tsx",
  "src/components/body/weight-history.tsx",
  "src/components/body/body-measurements.tsx",
].map(source);

describe("DateField", () => {
  it("renderiza la fecha lógica propia sin desplazarla por timezone", () => {
    expect(formatDateFieldValue("2026-08-21")).toBe("21 ago 2026");
    expect(formatDateFieldValue("")).toBe("Elegir fecha");
  });

  it("mantiene el input nativo sólo como mecanismo de selección y validación", () => {
    expect(dateField).toContain('type="date"');
    expect(dateField).toContain("opacity-0");
    expect(dateField).toContain("{...props}");
    expect(dateField).toContain("form.addEventListener(\"reset\"");
  });

  it("sincroniza los patrones controlado, uncontrolled y form.reset", () => {
    expect(dateField).toContain("const controlled = value !== undefined");
    expect(dateField).toContain("defaultValue={controlled ? undefined : defaultDate}");
    expect(dateField).toContain("value={controlled ? visibleValue : undefined}");
    expect(dateField).toContain("setUncontrolledValue(input.value)");
  });

  it("retira hacks WebKit y el tratamiento especial de Input", () => {
    expect(input).not.toContain('type === "date"');
    expect(globals).not.toContain("ownlevel-date-input");
  });

  it("usa la misma primitiva en todos los formularios de fecha reales", () => {
    for (const consumer of dateConsumers) {
      expect(consumer).toContain("date-field");
      expect(consumer).not.toContain('type="date"');
    }
  });
});
