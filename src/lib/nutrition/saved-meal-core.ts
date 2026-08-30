import type {
  SavedMeal,
  SavedMealItem,
} from "@/lib/phase1/types";
import { parseFoodQuantity } from "./food-quantity";

export type SavedMealCatalogFilter = "active" | "archived" | "all";
export type QuickAddTab = "saved" | "suggested";
export type SavedMealSummary = Pick<
  SavedMeal,
  | "id"
  | "name"
  | "description"
  | "template_type"
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "is_active"
> & { itemCount: number };

export type ScaledSavedMealItem = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type SavedMealTotals = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

type BaseSnapshot = Pick<
  SavedMealItem,
  | "id"
  | "label"
  | "unit"
  | "base_quantity"
  | "base_calories"
  | "base_protein_g"
  | "base_carbs_g"
  | "base_fat_g"
>;

function roundMacro(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function scaleNullable(value: number | null, factor: number) {
  return value === null ? null : roundMacro(value * factor);
}

/** Escala un snapshot sin inventar calorías ni transformar null en cero. */
export function scaleSavedMealItem(
  item: BaseSnapshot,
  quantityInput: unknown,
): ScaledSavedMealItem {
  const quantity = parseFoodQuantity(quantityInput);
  if (!Number.isFinite(item.base_quantity) || item.base_quantity <= 0) {
    throw new Error("La cantidad base del ingrediente no es válida.");
  }
  const factor = quantity / item.base_quantity;
  return {
    id: item.id,
    label: item.label,
    quantity,
    unit: item.unit,
    calories: item.base_calories === null
      ? null
      : Math.round(item.base_calories * factor),
    proteinG: scaleNullable(item.base_protein_g, factor),
    carbsG: scaleNullable(item.base_carbs_g, factor),
    fatG: scaleNullable(item.base_fat_g, factor),
  };
}

function sumKnown(
  items: ScaledSavedMealItem[],
  read: (item: ScaledSavedMealItem) => number | null,
  round: (value: number) => number,
) {
  if (items.length === 0 || items.some((item) => read(item) === null)) {
    return null;
  }
  return round(items.reduce((total, item) => total + (read(item) as number), 0));
}

/** Un solo valor desconocido vuelve desconocido el total de ese nutriente. */
export function sumSavedMealItems(
  items: ScaledSavedMealItem[],
): SavedMealTotals {
  return {
    calories: sumKnown(items, (item) => item.calories, Math.round),
    proteinG: sumKnown(items, (item) => item.proteinG, roundMacro),
    carbsG: sumKnown(items, (item) => item.carbsG, roundMacro),
    fatG: sumKnown(items, (item) => item.fatG, roundMacro),
  };
}

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-AR");
}

export function filterSavedMealCatalog<T extends Pick<SavedMeal, "name" | "is_active">>(
  meals: T[],
  filter: SavedMealCatalogFilter,
  search: string,
) {
  const term = searchable(search.trim());
  return meals.filter((meal) => {
    if (filter === "active" && !meal.is_active) return false;
    if (filter === "archived" && meal.is_active) return false;
    return !term || searchable(meal.name).includes(term);
  });
}

export function savedMealRegistrability(
  meal: Pick<SavedMeal, "calories">,
) {
  if (meal.calories === null) {
    return "Completá las calorías para poder agregarla.";
  }
  if (meal.calories <= 0) {
    return "Esta comida no tiene calorías registrables.";
  }
  return null;
}

export function defaultQuickAddTab(
  savedCount: number,
  suggestedCount: number,
): QuickAddTab {
  return savedCount > 0 || suggestedCount === 0 ? "saved" : "suggested";
}

export function formatSavedMealItemQuantity(
  quantity: number,
  unit: string,
) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`;
}

export function savedMealOccurrenceDescription(
  items: Array<Pick<ScaledSavedMealItem, "label" | "quantity" | "unit">>,
  fallback: string | null,
) {
  if (items.length === 0) return fallback ?? undefined;
  const shown = items.slice(0, 5).map(
    (item) => `${formatSavedMealItemQuantity(item.quantity, item.unit)} ${item.label.toLocaleLowerCase("es-AR")}`,
  );
  if (items.length > shown.length) shown.push(`+${items.length - shown.length} ingredientes`);
  return shown.join(" · ");
}
