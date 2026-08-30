import { describe, expect, it } from "vitest";
import type { Food } from "@/lib/phase1/types";
import { filterFoodCatalog } from "./food-catalog-core";

function food(id: string, name: string, isActive: boolean): Food {
  return {
    id,
    user_id: "user-1",
    name,
    description: null,
    serving_quantity: 100,
    serving_unit: "g",
    calories: 100,
    protein_g: null,
    carbs_g: 0,
    fat_g: null,
    precision_level: null,
    source_note: null,
    is_active: isActive,
    created_at: "2026-08-30T00:00:00Z",
    updated_at: "2026-08-30T00:00:00Z",
  };
}

const foods = [
  food("1", "PECHUGÁ DE POLLO", true),
  food("2", "PAPA", false),
];

describe("PR29 — filtros del catálogo", () => {
  it("distingue Activos, Archivados y Todos", () => {
    expect(filterFoodCatalog(foods, "active", "").map((item) => item.id)).toEqual(["1"]);
    expect(filterFoodCatalog(foods, "archived", "").map((item) => item.id)).toEqual(["2"]);
    expect(filterFoodCatalog(foods, "all", "").map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("busca por nombre sin depender de mayúsculas o acentos", () => {
    expect(filterFoodCatalog(foods, "all", "pechuga").map((item) => item.id)).toEqual(["1"]);
  });
});
