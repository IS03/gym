import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createMeal: vi.fn() }));
vi.mock("@/lib/phase1/day-log", () => ({ createMeal: mocks.createMeal }));

import { createMealFromFood } from "./food-entry";

const canonicalFood = {
  id: "food-1",
  user_id: "user-1",
  name: "PECHUGA TEST",
  description: "Corte magro",
  serving_quantity: 100,
  serving_unit: "g",
  calories: 120,
  protein_g: 20,
  carbs_g: 10,
  fat_g: 4,
  precision_level: "label",
  source_note: "Etiqueta de prueba",
  is_active: true,
};

function context(data: Record<string, unknown> | null, error: { code: string } | null = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return {
    builder,
    auth: {
      userId: "user-1",
      supabase: { from: vi.fn().mockReturnValue(builder) },
    },
  };
}

describe("PR29 — creación server-side desde Food", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMeal.mockResolvedValue({ id: "meal-1" });
  });

  it("relee el Food propio y activo, calcula snapshot y usa createMeal", async () => {
    const { auth, builder } = context({ ...canonicalFood });
    await createMealFromFood({ foodId: "food-1", quantity: "150", date: "2026-08-30" }, auth as never);

    expect(builder.eq).toHaveBeenCalledWith("id", "food-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.eq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.createMeal).toHaveBeenCalledWith(expect.objectContaining({
      title: "PECHUGA TEST",
      description: "150 g · Corte magro",
      final_calories: 180,
      final_protein_g: 30,
      final_carbs_g: 15,
      final_fat_g: 6,
      precision_level: "label",
      context_type: "food_quantity",
      source_note: "Etiqueta de prueba",
    }), auth);
  });

  it.each(["inexistente", "ajeno", "archivado"])(
    "rechaza un Food %s sin diferenciar datos que no pertenecen al usuario",
    async () => {
      const { auth } = context(null);
      await expect(createMealFromFood({ foodId: "food-x", quantity: 100, date: "2026-08-30" }, auth as never)).rejects.toThrow("ya no está disponible");
      expect(mocks.createMeal).not.toHaveBeenCalled();
    },
  );

  it("preserva macros parciales en el snapshot", async () => {
    const { auth } = context({ ...canonicalFood, carbs_g: null, fat_g: 0 });
    await createMealFromFood({ foodId: "food-1", quantity: 150, date: "2026-08-30" }, auth as never);
    expect(mocks.createMeal).toHaveBeenCalledWith(expect.objectContaining({
      final_carbs_g: null,
      final_fat_g: 0,
    }), auth);
  });

  it("el snapshot calculado no cambia si el Food se edita después", async () => {
    const food = { ...canonicalFood };
    const { auth } = context(food);
    await createMealFromFood({ foodId: "food-1", quantity: 150, date: "2026-08-30" }, auth as never);
    food.calories = 130;
    expect(mocks.createMeal.mock.calls[0][0].final_calories).toBe(180);
  });
});
