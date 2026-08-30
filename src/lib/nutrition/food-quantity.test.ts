import { describe, expect, it } from "vitest";
import {
  FoodQuantityError,
  parseFoodQuantity,
  scaleFoodNutrition,
} from "./food-quantity";

const baseFood = {
  serving_quantity: 100,
  serving_unit: "g",
  calories: 120,
  protein_g: 23,
  carbs_g: 0,
  fat_g: null,
};

describe("PR29 — escalado canónico de alimentos", () => {
  it("escala la porción con la misma unidad y preserva null y cero", () => {
    expect(scaleFoodNutrition(baseFood, "165")).toEqual({
      quantity: 165,
      unit: "g",
      factor: 1.65,
      calories: 198,
      proteinG: 37.95,
      carbsG: 0,
      fatG: null,
    });
  });

  it("redondea .5 kcal hacia el entero más cercano", () => {
    expect(scaleFoodNutrition({ ...baseFood, calories: 75 }, 150).calories).toBe(113);
  });

  it("redondea macros conocidos a dos decimales", () => {
    const scaled = scaleFoodNutrition({ ...baseFood, protein_g: 1.111, fat_g: 0 }, 150);
    expect(scaled.proteinG).toBe(1.67);
    expect(scaled.fatG).toBe(0);
  });

  it.each(["", "0", "-1", "NaN", "Infinity", Number.POSITIVE_INFINITY])(
    "rechaza cantidad inválida %s",
    (quantity) => expect(() => parseFoodQuantity(quantity)).toThrow("cantidad válida"),
  );

  it("acepta decimales localizados con coma o punto", () => {
    expect(parseFoodQuantity("165,5")).toBe(165.5);
    expect(parseFoodQuantity("165.5")).toBe(165.5);
  });

  it("no inventa calorías ausentes o en cero", () => {
    expect(() => scaleFoodNutrition({ ...baseFood, calories: null }, 100)).toThrow("Completá las calorías");
    expect(() => scaleFoodNutrition({ ...baseFood, calories: 0 }, 100)).toThrow("no tiene calorías registrables");
  });

  it("rechaza una cantidad cuyo redondeo canónico daría cero kcal", () => {
    expect(() => scaleFoodNutrition({ ...baseFood, calories: 1 }, 1)).toThrow("demasiado pequeña");
  });

  it("identifica los errores de dominio sin exponer detalles internos", () => {
    try {
      scaleFoodNutrition({ ...baseFood, calories: null }, 100);
    } catch (error) {
      expect(error).toBeInstanceOf(FoodQuantityError);
      expect((error as FoodQuantityError).code).toBe("missing_calories");
    }
  });
});
