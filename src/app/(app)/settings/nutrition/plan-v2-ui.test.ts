import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const plan = read("src/app/(app)/settings/nutrition/nutrition-plan-editor.tsx");
const energy = read("src/app/(app)/settings/nutrition/energy/energy-config-editor.tsx");
const actions = read("src/app/(app)/settings/nutrition/actions.ts");

describe("PR71 — Plan nutricional y Cálculo energético", () => {
  it("presenta siete días y ediciones rápidas sin guardar cada tecla", () => {
    expect(plan).toContain("WEEKDAYS.map");
    expect(plan).not.toContain("Copiar a todos");
    expect(plan).not.toContain("Aplicar Lun–Vie");
    expect(plan).toContain("Aplicar estos valores a");
    expect(plan).toContain("Solo ${WEEKDAYS.find");
    expect(plan).toContain("Lunes a viernes");
    expect(plan).toContain("Todos los días");
    expect(plan).toContain("Guardar plan");
    expect(plan).toContain("saveNutritionPlanV2Action");
  });

  it("permite versionar el objetivo sin hardcodear una etapa", () => {
    expect(plan).toContain("Objetivo nutricional");
    expect(plan).toContain("Nombre de la etapa");
    expect(plan).toContain("name,");
    expect(plan).not.toContain('name: "Recomposición suave"');
  });

  it("separa ajustes nutricionales de gasto energético", () => {
    expect(plan).toContain("trainingWater");
    expect(plan).toContain("trainingCalories");
    expect(energy).toContain("trainingExpenditureDeltaKcal");
    expect(energy).not.toContain("Agua");
  });

  it("usa datos reales, estado incompleto y actividad cotidiana", () => {
    expect(energy).toContain("Completá tus datos físicos para calcular tu gasto.");
    expect(energy).toContain('href="/settings/profile"');
    expect(energy).toContain('value: "low"');
    expect(energy).toContain('value: "moderate"');
    expect(energy).toContain('value: "high"');
    expect(energy).toContain("Guardar cálculo");
    expect(energy).toContain("Estimación automática");
    expect(energy).toContain("Gasto base usado");
    expect(energy).toContain("Personalizado");
    expect(actions).toContain("saveEnergyConfigV2Action");
  });
});
