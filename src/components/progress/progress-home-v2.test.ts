import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(app)/progress/page.tsx", "utf8");
const server = readFileSync("src/lib/progress/home-server.ts", "utf8");
const model = readFileSync("src/lib/progress/home.ts", "utf8");

describe("Progress Home V2 UI contract", () => {
  it("renders the approved section order", () => {
    const evolution = page.indexOf(">Tu evolución<");
    const changes = page.indexOf(">Qué cambió<");
    const relationships = page.indexOf(">Relaciones<");
    const habits = page.indexOf(">Tus hábitos<");
    const explore = page.indexOf(">Explorar tu progreso<");
    const review = page.indexOf(">Revisar datos<");
    expect([evolution, changes, relationships, habits, explore, review].every((index) => index >= 0)).toBe(true);
    expect(evolution).toBeLessThan(changes);
    expect(changes).toBeLessThan(relationships);
    expect(relationships).toBeLessThan(habits);
    expect(habits).toBeLessThan(explore);
    expect(explore).toBeLessThan(review);
  });

  it("keeps every visible navigation row connected to its canonical destination", () => {
    expect(page).toContain('progressHomeDestinationHref("training", period)');
    expect(page).toContain('progressHomeDestinationHref("nutrition", period)');
    expect(page).toContain('progressHomeDestinationHref("body", period)');
    expect(page).toContain('progressHomeDestinationHref("activity", period)');
    expect(page).toContain('progressHomeDestinationHref("relationships", period)');
    expect(page).toContain('progressHomeDestinationHref("calendar", period)');
    expect(page).toContain('progressHomeDestinationHref("history", period)');
  });

  it("loads independent domains in parallel and consumes PR11 highlights", () => {
    expect(server).toContain("await Promise.all([");
    expect(server).toContain("getHighlightedRelationshipsForUser");
    expect(server).toContain("getTrainingGeneralAnalysis");
    expect(server).toContain("getNutritionReportWithProgressComparison");
    expect(server).toContain("getDailyMetricsReport");
    expect(server).toContain("buildBodyProgressReport");
  });

  it("keeps failed domains explicit without replacing them with no-data copy", () => {
    expect(server).toContain("Promise<ReadResult<T>>");
    expect(server).toContain("unavailableDomains");
    expect(server).toContain('status === "unavailable"');
    expect(page).toContain("No pudimos actualizar");
    expect(page).toContain('unavailable.has("relationships")');
    expect(page).toContain('isIncomplete("nutrition", "activity")');
  });

  it("does not hardcode personal metric names or introduce causal copy", () => {
    for (const fixedName of ["Pasos", "Sueño", "Agua", "Energía"]) expect(model).not.toContain(fixedName);
    for (const causal of ["causó", "provocó", "hizo que", "gracias a", "debido a"]) {
      expect(`${page}\n${model}`.toLocaleLowerCase("es-AR")).not.toContain(causal);
    }
  });

  it("keeps Home compact without analytical charts", () => {
    expect(page).not.toContain("<svg");
    expect(page).not.toContain("ChartDetail");
    expect(page).not.toContain("ResponsiveContainer");
  });
});
