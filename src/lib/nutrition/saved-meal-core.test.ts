import { describe, expect, it } from "vitest";
import type { SavedMealItem } from "@/lib/phase1/types";
import {
  defaultQuickAddTab,
  filterSavedMealCatalog,
  savedMealRegistrability,
  scaleSavedMealItem,
  sumSavedMealItems,
} from "./saved-meal-core";

const foodA: SavedMealItem = {
  id: "item-a",
  saved_meal_id: "saved-1",
  user_id: "user-1",
  label: "FOOD A",
  quantity: 150,
  unit: "g",
  base_quantity: 100,
  base_calories: 120,
  base_protein_g: 20,
  base_carbs_g: 10,
  base_fat_g: 4,
  source_food_id: "food-a",
  position: 0,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
};

describe("PR30 — cálculo de comidas habituales", () => {
  it("escala el snapshot de un componente con las reglas canónicas de PR29", () => {
    expect(scaleSavedMealItem(foodA, 150)).toEqual({
      id: "item-a",
      label: "FOOD A",
      quantity: 150,
      unit: "g",
      calories: 180,
      proteinG: 30,
      carbsG: 15,
      fatG: 6,
    });
  });

  it("suma un composite y redondea calorías/macros de forma consistente", () => {
    const foodB = {
      ...foodA,
      id: "item-b",
      label: "FOOD B",
      unit: "unidad",
      base_quantity: 1,
      base_calories: 78,
      base_protein_g: 6.3,
      base_carbs_g: 0.6,
      base_fat_g: 5.3,
    };
    expect(sumSavedMealItems([
      scaleSavedMealItem(foodA, 150),
      scaleSavedMealItem(foodB, 1),
    ])).toEqual({ calories: 258, proteinG: 36.3, carbsG: 15.6, fatG: 11.3 });
  });

  it("propaga null por nutriente y conserva cero conocido", () => {
    const partial = { ...foodA, id: "item-b", base_carbs_g: null, base_fat_g: 0 };
    const totals = sumSavedMealItems([
      scaleSavedMealItem(foodA, 100),
      scaleSavedMealItem(partial, 100),
    ]);
    expect(totals.carbsG).toBeNull();
    expect(totals.fatG).toBe(4);
  });

  it("ajusta una ocurrencia sin mutar la cantidad default de la plantilla", () => {
    expect(scaleSavedMealItem(foodA, 200)).toMatchObject({
      calories: 240,
      proteinG: 40,
      carbsG: 20,
      fatG: 8,
    });
    expect(foodA.quantity).toBe(150);
  });

  it("distingue activa de registrable sin inventar calorías", () => {
    expect(savedMealRegistrability({ calories: null })).toContain("Completá");
    expect(savedMealRegistrability({ calories: 0 })).toContain("no tiene calorías");
    expect(savedMealRegistrability({ calories: 300 })).toBeNull();
  });

  it("elige un tab inicial determinista", () => {
    expect(defaultQuickAddTab(2, 3)).toBe("saved");
    expect(defaultQuickAddTab(0, 3)).toBe("suggested");
    expect(defaultQuickAddTab(0, 0)).toBe("saved");
  });

  it("filtra Activas/Archivadas/Todas con búsqueda accent-friendly", () => {
    const meals = [
      { name: "PANQUÉ PROTEICO", is_active: true },
      { name: "WRAP", is_active: false },
    ];
    expect(filterSavedMealCatalog(meals, "active", "panque")).toEqual([meals[0]]);
    expect(filterSavedMealCatalog(meals, "archived", "")).toEqual([meals[1]]);
    expect(filterSavedMealCatalog(meals, "all", "")).toHaveLength(2);
  });
});
