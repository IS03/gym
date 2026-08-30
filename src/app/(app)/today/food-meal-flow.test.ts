import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/today/page.tsx");
const composer = source("src/app/(app)/today/meal-composer.tsx");
const form = source("src/app/(app)/today/food-meal-form.tsx");
const actions = source("src/app/(app)/today/actions.ts");
const entry = source("src/lib/nutrition/food-entry.ts");

describe("PR29 — registrar alimento por cantidad", () => {
  it("carga Foods activos en paralelo y mantiene Manual junto a Desde alimento", () => {
    expect(page).toContain("listActiveFoods(auth)");
    expect(page).toContain("Promise.all");
    expect(composer).toContain(">Manual<");
    expect(composer).toContain(">Desde alimento<");
    expect(composer).toContain("<CreateMealForm");
    expect(composer).toContain("<FoodMealForm");
  });

  it("el cliente envía sólo identidad, cantidad y fecha", () => {
    expect(form).toContain("foodId: selected.id");
    expect(form).toContain("quantity,");
    expect(form).toContain("date,");
    expect(form).not.toContain("final_calories:");
    expect(form).not.toContain("final_protein_g:");
  });

  it("la action autentica y el servidor exige owner + activo", () => {
    expect(actions).toContain("requireAuthenticatedRequestContext()");
    expect(actions).toContain("createMealFromFood(input, auth)");
    expect(entry).toContain('.eq("user_id", context.userId)');
    expect(entry).toContain('.eq("is_active", true)');
    expect(entry).toContain('context_type: "food_quantity"');
  });

  it("mantiene Comidas sugeridas como flujo independiente", () => {
    expect(composer).toContain("<QuickMeals meals={quickMeals}");
  });
});
