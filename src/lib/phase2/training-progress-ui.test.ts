import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/training/training-insights.tsx", "utf8");

describe("selector semanal responsive", () => {
  it("usa una grilla 2×2 de ancho completo en mobile y cuatro celdas iguales en desktop", () => {
    expect(source).toContain("grid w-full grid-cols-2");
    expect(source).toContain("lg:grid-cols-4");
    expect(source).toContain('className="h-9 w-full min-w-0');
    expect(source).toContain("WEEKLY_CHART_METRICS.map");
  });
});
