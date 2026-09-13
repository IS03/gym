import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/progress/relationships/page.tsx", "utf8");
const explorer = readFileSync("src/components/progress/relationship-explorer.tsx", "utf8");
const result = readFileSync("src/components/progress/relationship-result.tsx", "utf8");

describe("Relationships V2 UI contract", () => {
  it("keeps the explorer dynamic and filters B from typed compatibility", () => {
    expect(explorer).toContain("pairs.filter((pair) => pair.aKey === aKey)");
    expect(explorer).toContain("Variable A");
    expect(explorer).toContain("Variable B");
    expect(explorer).toContain("no implica causalidad");
    expect(explorer).not.toMatch(/Pasos|Sueño|Agua|Energía/);
  });

  it("renders result sections in the approved order with visible quality and sample", () => {
    const labels = ["Variables analizadas", "Conclusión", "Interpretación", "Cobertura", "Calidad de señal", "Visualización", "Insight resumido", "Ver metodología"];
    for (let index = 1; index < labels.length; index += 1) {
      expect(result.indexOf(labels[index - 1]!)).toBeLessThan(result.indexOf(labels[index]!));
    }
    expect(result).toContain("sampleSize");
    expect(result).toContain("qualityLabel");
    expect(result).not.toMatch(/estadísticamente significativo|hizo que|causó|provocó/i);
  });

  it("keeps highlights below the manual explorer and leaves Home V2 out", () => {
    expect(page.indexOf("Explorador")).toBeLessThan(page.indexOf("Relaciones destacadas"));
    expect(page).toContain("getRelationshipsWorkspace");
    expect(page).not.toContain("Tu evolución");
  });
});
