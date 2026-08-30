import "server-only";

import { createMeal } from "@/lib/phase1/day-log";
import type {
  Food,
  SavedMeal,
  SavedMealItem,
  SavedMealTemplateType,
  SavedMealWithItems,
} from "@/lib/phase1/types";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";
import { parseOptionalNumber } from "./product";
import { parseFoodQuantity } from "./food-quantity";
import { normalizeMealText } from "./meal-macros";
import { quickMealWindow } from "./quick-meals-core";
import {
  savedMealOccurrenceDescription,
  savedMealRegistrability,
  scaleSavedMealItem,
  sumSavedMealItems,
  type SavedMealSummary,
} from "./saved-meal-core";

const SAVED_MEAL_SELECT = "id,user_id,name,description,template_type,calories,protein_g,carbs_g,fat_g,is_active,created_at,updated_at";
const SAVED_MEAL_SUMMARY_SELECT = "id,name,description,template_type,calories,protein_g,carbs_g,fat_g,is_active";
const SAVED_MEAL_ITEM_SELECT = "id,saved_meal_id,user_id,label,quantity,unit,base_quantity,base_calories,base_protein_g,base_carbs_g,base_fat_g,source_food_id,position,created_at,updated_at";

export class SavedMealProductError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedMealProductError";
  }
}

export type { SavedMealSummary } from "./saved-meal-core";

export type SavedMealItemMutation =
  | { kind: "food"; foodId: string; quantity: unknown }
  | { kind: "snapshot"; itemId: string; quantity: unknown };

export type SavedMealMutationInput = {
  id?: string;
  name: string;
  description?: string;
  templateType: SavedMealTemplateType;
  calories?: unknown;
  proteinG?: unknown;
  carbsG?: unknown;
  fatG?: unknown;
  items?: SavedMealItemMutation[];
};

function cleanText(value: unknown, label: string, required = true) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !normalized) throw new SavedMealProductError(`${label} es obligatorio.`);
  return normalized || null;
}

function normalizeNestedItems(row: SavedMeal & { saved_meal_items?: SavedMealItem[] }) {
  const { saved_meal_items: nestedItems = [], ...meal } = row;
  return {
    ...meal,
    items: [...nestedItems].toSorted(
      (left, right) => left.position - right.position,
    ),
  } as SavedMealWithItems;
}

export async function listSavedMeals(
  context?: AuthenticatedRequestContext,
): Promise<SavedMealWithItems[]> {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const { data, error } = await auth.supabase
    .from("saved_meals")
    .select(`${SAVED_MEAL_SELECT},saved_meal_items(${SAVED_MEAL_ITEM_SELECT})`)
    .eq("user_id", auth.userId)
    .order("is_active", { ascending: false })
    .order("name");
  if (error) {
    console.warn("[saved-meals] list_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos leer las comidas habituales.");
  }
  return (data ?? []).map((row) => normalizeNestedItems(row as never));
}

export async function listActiveSavedMeals(
  context?: AuthenticatedRequestContext,
): Promise<SavedMealSummary[]> {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const { data, error } = await auth.supabase
    .from("saved_meals")
    .select(`${SAVED_MEAL_SUMMARY_SELECT},saved_meal_items(count)`)
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .order("name");
  if (error) {
    console.warn("[saved-meals] active_list_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos leer las comidas habituales.");
  }
  return (data ?? []).map((row) => {
    const nested = (row as typeof row & { saved_meal_items?: Array<{ count: number }> }).saved_meal_items;
    const meal: Record<string, unknown> = { ...row };
    delete meal.saved_meal_items;
    return { ...(meal as unknown as Omit<SavedMealSummary, "itemCount">), itemCount: nested?.[0]?.count ?? 0 };
  });
}

async function readSavedMeal(
  id: string,
  auth: AuthenticatedRequestContext,
  activeOnly = false,
): Promise<SavedMealWithItems | null> {
  let query = auth.supabase
    .from("saved_meals")
    .select(`${SAVED_MEAL_SELECT},saved_meal_items(${SAVED_MEAL_ITEM_SELECT})`)
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[saved-meals] canonical_read_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos leer la comida habitual.");
  }
  return data ? normalizeNestedItems(data as never) : null;
}

function parseManualNutrition(input: SavedMealMutationInput) {
  let nutrition;
  try {
    nutrition = {
      calories: parseOptionalNumber(input.calories, "Calorías", { integer: true, min: 0 }),
      proteinG: parseOptionalNumber(input.proteinG, "Proteína", { min: 0 }),
      carbsG: parseOptionalNumber(input.carbsG, "Carbohidratos", { min: 0 }),
      fatG: parseOptionalNumber(input.fatG, "Grasas", { min: 0 }),
    };
  } catch (error) {
    throw new SavedMealProductError(
      error instanceof Error ? error.message : "Revisá los valores nutricionales.",
    );
  }
  if (Object.values(nutrition).every((value) => value === null)) {
    throw new SavedMealProductError("Informá al menos un valor nutricional.");
  }
  return nutrition;
}

async function materializeCompositeItems(
  input: SavedMealMutationInput,
  auth: AuthenticatedRequestContext,
) {
  const requested = input.items ?? [];
  if (requested.length < 1 || requested.length > 50) {
    throw new SavedMealProductError("Agregá entre 1 y 50 ingredientes.");
  }
  if (requested.some((item) => (
    (item.kind !== "food" && item.kind !== "snapshot")
    || (item.kind === "food" && !item.foodId?.trim())
    || (item.kind === "snapshot" && !item.itemId?.trim())
  ))) {
    throw new SavedMealProductError("Un ingrediente no es válido.");
  }
  const snapshotIds = requested.flatMap((item) => item.kind === "snapshot" ? [item.itemId] : []);
  const foodIds = requested.flatMap((item) => item.kind === "food" ? [item.foodId] : []);
  if (new Set(snapshotIds).size !== snapshotIds.length || new Set(foodIds).size !== foodIds.length) {
    throw new SavedMealProductError("No repitas el mismo ingrediente.");
  }
  if (snapshotIds.length > 0 && !input.id) {
    throw new SavedMealProductError("El ingrediente guardado no pertenece a esta comida.");
  }

  const [snapshotResult, foodResult] = await Promise.all([
    snapshotIds.length === 0
      ? Promise.resolve({ data: [] as SavedMealItem[], error: null })
      : auth.supabase.from("saved_meal_items").select(SAVED_MEAL_ITEM_SELECT)
        .eq("saved_meal_id", input.id as string).eq("user_id", auth.userId).in("id", snapshotIds),
    foodIds.length === 0
      ? Promise.resolve({ data: [] as Food[], error: null })
      : auth.supabase.from("foods")
        .select("id,user_id,name,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,is_active")
        .eq("user_id", auth.userId).eq("is_active", true).in("id", foodIds),
  ]);
  if (snapshotResult.error || foodResult.error) {
    console.warn("[saved-meals] ingredient_read_failed", {
      snapshotCode: snapshotResult.error?.code,
      foodCode: foodResult.error?.code,
    });
    throw new SavedMealProductError("No pudimos validar los ingredientes.");
  }
  const snapshots = new Map((snapshotResult.data ?? []).map((item) => [item.id, item as SavedMealItem]));
  const foods = new Map((foodResult.data ?? []).map((food) => [food.id, food as Food]));
  if (snapshots.size !== snapshotIds.length) {
    throw new SavedMealProductError("Un ingrediente guardado ya no está disponible.");
  }
  if (foods.size !== foodIds.length) {
    throw new SavedMealProductError("Un alimento ya no está disponible o está archivado.");
  }
  const sourceFoodIds = requested.flatMap((item) => {
    if (item.kind === "food") return [item.foodId];
    const sourceFoodId = snapshots.get(item.itemId)?.source_food_id;
    return sourceFoodId ? [sourceFoodId] : [];
  });
  if (new Set(sourceFoodIds).size !== sourceFoodIds.length) {
    throw new SavedMealProductError("No repitas el mismo ingrediente.");
  }

  return requested.map((item) => {
    let quantity: number;
    try {
      quantity = parseFoodQuantity(item.quantity);
    } catch (error) {
      throw new SavedMealProductError(
        error instanceof Error ? error.message : "Ingresá una cantidad válida.",
      );
    }
    if (item.kind === "snapshot") {
      const source = snapshots.get(item.itemId) as SavedMealItem;
      return {
        label: source.label,
        quantity,
        unit: source.unit,
        base_quantity: source.base_quantity,
        base_calories: source.base_calories,
        base_protein_g: source.base_protein_g,
        base_carbs_g: source.base_carbs_g,
        base_fat_g: source.base_fat_g,
        source_food_id: source.source_food_id,
      };
    }
    const source = foods.get(item.foodId) as Food;
    return {
      label: source.name,
      quantity,
      unit: source.serving_unit,
      base_quantity: source.serving_quantity,
      base_calories: source.calories,
      base_protein_g: source.protein_g,
      base_carbs_g: source.carbs_g,
      base_fat_g: source.fat_g,
      source_food_id: source.id,
    };
  });
}

export async function saveSavedMeal(
  input: SavedMealMutationInput,
  context?: AuthenticatedRequestContext,
): Promise<SavedMealWithItems> {
  const auth = context ?? await requireAuthenticatedRequestContext();
  if (input.templateType !== "manual" && input.templateType !== "composite") {
    throw new SavedMealProductError("Elegí un tipo de comida habitual válido.");
  }
  const name = cleanText(input.name, "Nombre") as string;
  const description = cleanText(input.description, "Descripción", false);
  const manual = input.templateType === "manual"
    ? parseManualNutrition(input)
    : { calories: null, proteinG: null, carbsG: null, fatG: null };
  const items = input.templateType === "composite"
    ? await materializeCompositeItems(input, auth)
    : [];

  const { data, error } = await auth.supabase.rpc("save_saved_meal_template", {
    p_saved_meal_id: input.id ?? null,
    p_name: name,
    p_description: description,
    p_template_type: input.templateType,
    p_manual_calories: manual.calories,
    p_manual_protein_g: manual.proteinG,
    p_manual_carbs_g: manual.carbsG,
    p_manual_fat_g: manual.fatG,
    p_items: items,
  });
  if (error?.code === "23505") {
    throw new SavedMealProductError("Ya tenés una comida habitual activa con ese nombre.");
  }
  if (error) {
    console.warn("[saved-meals] save_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos guardar la comida habitual.");
  }
  const returned = Array.isArray(data) ? data[0] : data;
  const id = (returned as { id?: string } | null)?.id ?? input.id;
  if (!id) throw new SavedMealProductError("No pudimos confirmar la comida guardada.");
  const saved = await readSavedMeal(id, auth);
  if (!saved) throw new SavedMealProductError("No pudimos confirmar la comida guardada.");
  return saved;
}

export async function setSavedMealActive(
  id: string,
  active: boolean,
): Promise<SavedMealWithItems> {
  const auth = await requireAuthenticatedRequestContext();
  const { error } = await auth.supabase.from("saved_meals")
    .update({ is_active: active }).eq("id", id).eq("user_id", auth.userId).select("id").single();
  if (error?.code === "23505") {
    throw new SavedMealProductError("Ya tenés una comida habitual activa con ese nombre.");
  }
  if (error) {
    console.warn("[saved-meals] active_state_failed", { code: error.code });
    throw new SavedMealProductError(`No pudimos ${active ? "reactivar" : "archivar"} la comida habitual.`);
  }
  const meal = await readSavedMeal(id, auth);
  if (!meal) throw new SavedMealProductError("Esta comida habitual ya no está disponible.");
  return meal;
}

export async function deleteSavedMeal(id: string): Promise<void> {
  const auth = await requireAuthenticatedRequestContext();
  const { data, error } = await auth.supabase.from("saved_meals").delete()
    .eq("id", id).eq("user_id", auth.userId).select("id").maybeSingle();
  if (error) {
    console.warn("[saved-meals] delete_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos eliminar la comida habitual.");
  }
  if (!data) throw new SavedMealProductError("Esta comida habitual ya no está disponible.");
}

export async function saveSuggestedMeal(
  sourceMealId: string,
  today: string,
  context?: AuthenticatedRequestContext,
) {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const window = quickMealWindow(today);
  const { data, error } = await auth.supabase.from("meal_entries")
    .select("title,description,final_calories,final_protein_g,final_carbs_g,final_fat_g,day_logs!inner(log_date)")
    .eq("id", sourceMealId).eq("user_id", auth.userId).is("deleted_at", null)
    .eq("entry_kind", "meal").eq("source_type", "manual")
    .gte("day_logs.log_date", window.start).lte("day_logs.log_date", window.end)
    .maybeSingle();
  if (error) {
    console.warn("[saved-meals] suggestion_read_failed", { code: error.code });
    throw new SavedMealProductError("No pudimos leer la comida sugerida.");
  }
  if (!data || data.final_calories === null || data.final_calories <= 0) {
    throw new SavedMealProductError("Esta comida sugerida ya no está disponible.");
  }
  const normalizedTitle = normalizeMealText(data.title);
  const normalizedDescription = normalizeMealText(data.description);
  const name = (normalizedTitle ?? normalizedDescription)?.slice(0, 120);
  if (!name) throw new SavedMealProductError("Esta sugerencia no tiene un nombre registrable.");
  return saveSavedMeal({
    name,
    description: data.description ?? undefined,
    templateType: "manual",
    calories: data.final_calories,
    proteinG: data.final_protein_g,
    carbsG: data.final_carbs_g,
    fatG: data.final_fat_g,
  }, auth);
}

async function createMealFromSavedMeal(
  meal: SavedMealWithItems,
  date: string,
  adjustedItems?: Array<{ itemId: string; quantity: unknown }>,
  context?: AuthenticatedRequestContext,
) {
  const reason = savedMealRegistrability(meal);
  if (reason) throw new SavedMealProductError(reason);

  let totals = {
    calories: meal.calories,
    proteinG: meal.protein_g,
    carbsG: meal.carbs_g,
    fatG: meal.fat_g,
  };
  let description = meal.description ?? undefined;

  if (meal.items.length > 0) {
    const quantities = adjustedItems ?? meal.items.map((item) => ({ itemId: item.id, quantity: item.quantity }));
    if (quantities.length !== meal.items.length || new Set(quantities.map((item) => item.itemId)).size !== meal.items.length) {
      throw new SavedMealProductError("Los ingredientes de esta comida cambiaron. Volvé a abrirla.");
    }
    const byId = new Map(quantities.map((item) => [item.itemId, item.quantity]));
    if (meal.items.some((item) => !byId.has(item.id))) {
      throw new SavedMealProductError("Los ingredientes de esta comida cambiaron. Volvé a abrirla.");
    }
    const scaled = meal.items.map((item) => scaleSavedMealItem(item, byId.get(item.id)));
    totals = sumSavedMealItems(scaled);
    description = savedMealOccurrenceDescription(scaled, meal.description);
  }

  if (totals.calories === null || totals.calories <= 0) {
    throw new SavedMealProductError("Completá las calorías para poder agregarla.");
  }
  return createMeal({
    date,
    title: meal.name,
    description,
    final_calories: totals.calories,
    final_protein_g: totals.proteinG,
    final_carbs_g: totals.carbsG,
    final_fat_g: totals.fatG,
    context_type: "saved_meal",
  }, context);
}

export async function quickAddSavedMeal(
  savedMealId: string,
  date: string,
  context?: AuthenticatedRequestContext,
) {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const meal = await readSavedMeal(savedMealId, auth, true);
  if (!meal) throw new SavedMealProductError("Esta comida habitual ya no está disponible.");
  return createMealFromSavedMeal(meal, date, undefined, auth);
}

export async function addAdjustedSavedMeal(
  input: { savedMealId: string; date: string; items: Array<{ itemId: string; quantity: unknown }> },
  context?: AuthenticatedRequestContext,
) {
  const auth = context ?? await requireAuthenticatedRequestContext();
  const meal = await readSavedMeal(input.savedMealId, auth, true);
  if (!meal) throw new SavedMealProductError("Esta comida habitual ya no está disponible.");
  if (meal.items.length === 0) {
    throw new SavedMealProductError("Esta comida no tiene ingredientes para ajustar.");
  }
  return createMealFromSavedMeal(meal, input.date, input.items, auth);
}

export async function getSavedMealAdjustment(
  savedMealId: string,
): Promise<SavedMealWithItems> {
  const auth = await requireAuthenticatedRequestContext();
  const meal = await readSavedMeal(savedMealId, auth, true);
  if (!meal) throw new SavedMealProductError("Esta comida habitual ya no está disponible.");
  return meal;
}
