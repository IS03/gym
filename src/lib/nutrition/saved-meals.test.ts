import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createMeal: vi.fn() }));
vi.mock("@/lib/phase1/day-log", () => ({ createMeal: mocks.createMeal }));
vi.mock("@/lib/supabase/server", () => ({
  requireAuthenticatedRequestContext: vi.fn(),
  createClient: vi.fn(),
}));

import {
  addAdjustedSavedMeal,
  quickAddSavedMeal,
  saveSavedMeal,
  saveSuggestedMeal,
} from "./saved-meals";

const baseMeal = {
  id: "saved-1",
  user_id: "user-1",
  name: "PR30 TEST",
  description: "Base sintética",
  template_type: "manual",
  calories: 300,
  protein_g: 25,
  carbs_g: 30,
  fat_g: 8,
  is_active: true,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
  saved_meal_items: [],
};

function context(data: Record<string, unknown> | null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return {
    builder,
    auth: { userId: "user-1", supabase: { from: vi.fn().mockReturnValue(builder) } },
  };
}

function queryResult(data: unknown) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: PromiseLike<{ data: unknown; error: null }>["then"];
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  for (const method of ["select", "eq", "is", "gte", "lte", "in"] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.then = (onFulfilled, onRejected) => Promise.resolve({ data, error: null })
    .then(onFulfilled, onRejected);
  return builder;
}

function mutationContext({ food, sourceMeal, saved = baseMeal }: {
  food?: Record<string, unknown> | null;
  sourceMeal?: Record<string, unknown> | null;
  saved?: Record<string, unknown>;
}) {
  const foodQuery = queryResult(food ? [food] : []);
  const sourceQuery = queryResult(sourceMeal ?? null);
  const savedQuery = queryResult(saved);
  const from = vi.fn((table: string) => {
    if (table === "foods") return foodQuery;
    if (table === "meal_entries") return sourceQuery;
    if (table === "saved_meals") return savedQuery;
    throw new Error(`unexpected table ${table}`);
  });
  const rpc = vi.fn().mockResolvedValue({ data: { id: saved.id }, error: null });
  return {
    auth: { userId: "user-1", supabase: { from, rpc } },
    foodQuery,
    sourceQuery,
    rpc,
  };
}

describe("PR30 — snapshot server-side desde SavedMeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMeal.mockResolvedValue({ id: "meal-1" });
  });

  it("relee una habitual propia y activa antes del one-tap add", async () => {
    const { auth, builder } = context(baseMeal);
    await quickAddSavedMeal("saved-1", "2026-08-30", auth as never);
    expect(builder.eq).toHaveBeenCalledWith("id", "saved-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.createMeal).toHaveBeenCalledWith(expect.objectContaining({
      title: "PR30 TEST",
      final_calories: 300,
      final_protein_g: 25,
      final_carbs_g: 30,
      final_fat_g: 8,
      context_type: "saved_meal",
    }), auth);
  });

  it.each(["archivada", "ajena", "inexistente"])("rechaza una habitual %s", async () => {
    const { auth } = context(null);
    await expect(quickAddSavedMeal("saved-x", "2026-08-30", auth as never)).rejects.toThrow("ya no está disponible");
    expect(mocks.createMeal).not.toHaveBeenCalled();
  });

  it("recalcula un ajuste desde snapshots y no modifica la plantilla", async () => {
    const item = {
      id: "item-1",
      saved_meal_id: "saved-1",
      user_id: "user-1",
      label: "PR30 TEST FOOD",
      quantity: 150,
      unit: "g",
      base_quantity: 100,
      base_calories: 120,
      base_protein_g: 20,
      base_carbs_g: 10,
      base_fat_g: 4,
      source_food_id: "food-1",
      position: 0,
      created_at: "2026-08-30T00:00:00Z",
      updated_at: "2026-08-30T00:00:00Z",
    };
    const { auth } = context({ ...baseMeal, template_type: "composite", calories: 180, protein_g: 30, carbs_g: 15, fat_g: 6, saved_meal_items: [item] });
    await addAdjustedSavedMeal({ savedMealId: "saved-1", date: "2026-08-30", items: [{ itemId: "item-1", quantity: 200 }] }, auth as never);
    expect(mocks.createMeal).toHaveBeenCalledWith(expect.objectContaining({
      final_calories: 240,
      final_protein_g: 40,
      final_carbs_g: 20,
      final_fat_g: 8,
    }), auth);
    expect(item.quantity).toBe(150);
  });

  it("rechaza IDs de componentes faltantes o duplicados", async () => {
    const item = { id: "item-1", saved_meal_id: "saved-1", user_id: "user-1", label: "A", quantity: 1, unit: "u", base_quantity: 1, base_calories: 100, base_protein_g: null, base_carbs_g: null, base_fat_g: null, source_food_id: null, position: 0, created_at: "", updated_at: "" };
    const { auth } = context({ ...baseMeal, template_type: "composite", saved_meal_items: [item] });
    await expect(addAdjustedSavedMeal({ savedMealId: "saved-1", date: "2026-08-30", items: [{ itemId: "otro", quantity: 1 }] }, auth as never)).rejects.toThrow("cambiaron");
  });

  it("materializa un Food propio activo desde valores canónicos del servidor", async () => {
    const food = {
      id: "food-1", user_id: "user-1", name: "PR30 TEST FOOD",
      serving_quantity: 100, serving_unit: "g", calories: 120,
      protein_g: 20, carbs_g: 10, fat_g: 4, is_active: true,
    };
    const item = {
      id: "item-1", saved_meal_id: "saved-1", user_id: "user-1",
      label: food.name, quantity: 150, unit: "g", base_quantity: 100,
      base_calories: 120, base_protein_g: 20, base_carbs_g: 10,
      base_fat_g: 4, source_food_id: "food-1", position: 0,
      created_at: "", updated_at: "",
    };
    const { auth, foodQuery, rpc } = mutationContext({
      food,
      saved: { ...baseMeal, template_type: "composite", calories: 180, saved_meal_items: [item] },
    });

    await saveSavedMeal({
      name: "PR30 COMPOSITE",
      templateType: "composite",
      items: [{ kind: "food", foodId: "food-1", quantity: "150" }],
    }, auth as never);

    expect(foodQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(foodQuery.eq).toHaveBeenCalledWith("is_active", true);
    expect(rpc).toHaveBeenCalledWith("save_saved_meal_template", expect.objectContaining({
      p_items: [expect.objectContaining({
        quantity: 150,
        base_quantity: 100,
        base_calories: 120,
        base_protein_g: 20,
        source_food_id: "food-1",
      })],
    }));
  });

  it("relee la MealEntry sugerida propia/elegible antes de guardarla", async () => {
    const sourceMeal = {
      title: "PR30 SUGERIDA",
      description: "Snapshot histórico",
      final_calories: 300,
      final_protein_g: 25,
      final_carbs_g: 30,
      final_fat_g: 8,
      day_logs: { log_date: "2026-08-29" },
    };
    const { auth, sourceQuery, rpc } = mutationContext({ sourceMeal });

    await saveSuggestedMeal("meal-source", "2026-08-30", auth as never);

    expect(sourceQuery.eq).toHaveBeenCalledWith("id", "meal-source");
    expect(sourceQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(sourceQuery.eq).toHaveBeenCalledWith("entry_kind", "meal");
    expect(sourceQuery.eq).toHaveBeenCalledWith("source_type", "manual");
    expect(sourceQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(rpc).toHaveBeenCalledWith("save_saved_meal_template", expect.objectContaining({
      p_name: "PR30 SUGERIDA",
      p_template_type: "manual",
      p_manual_calories: 300,
      p_manual_protein_g: 25,
    }));
  });
});
