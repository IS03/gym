import { describe, expect, it } from "vitest";
import { filterQuickAddItems } from "./quick-add-core";

const meals = [
  { name: "PANQUEQUES PROTEICOS" },
  { name: "Tostadas con queso crema" },
  { name: "BARRA PROTE" },
];

describe("quick add search", () => {
  it("filtra Habituales y Sugeridas sin distinguir mayúsculas", () => {
    expect(filterQuickAddItems(meals, "panq", (meal) => meal.name)).toEqual([
      meals[0],
    ]);
    expect(filterQuickAddItems(meals, "PROTE", (meal) => meal.name)).toEqual([
      meals[0],
      meals[2],
    ]);
  });

  it("tolera acentos, informa sin resultados y permite limpiar la búsqueda", () => {
    expect(filterQuickAddItems(meals, "queso", (meal) => meal.name)).toEqual([
      meals[1],
    ]);
    expect(filterQuickAddItems(meals, "omelette", (meal) => meal.name)).toEqual([]);
    expect(filterQuickAddItems(meals, "", (meal) => meal.name)).toBe(meals);
  });
});
