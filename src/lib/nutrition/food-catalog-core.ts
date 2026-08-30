import type { Food } from "@/lib/phase1/types";

export type FoodCatalogFilter = "active" | "archived" | "all";

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-AR");
}

export function filterFoodCatalog(
  foods: Food[],
  filter: FoodCatalogFilter,
  search: string,
) {
  const term = searchable(search.trim());
  return foods.filter((food) => {
    if (filter === "active" && !food.is_active) return false;
    if (filter === "archived" && food.is_active) return false;
    return !term || searchable(food.name).includes(term);
  });
}
