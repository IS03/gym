import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const mealList = source("src/app/(app)/today/meal-list.tsx");
const actions = source("src/app/(app)/today/actions.ts");
const dayLog = source("src/lib/phase1/day-log.ts");

describe("PR28 — lista y edición de comidas", () => {
  it("mantiene los registros cerrados y abre un único editor responsive", () => {
    expect(mealList).toContain("<ResponsiveDialog");
    expect(mealList).toContain("Editar comida");
    expect(mealList).toContain("line-clamp-2");
    expect(mealList).not.toContain("<form action={updateMealAction}");
    expect(mealList).not.toContain("Confirmada (todas las comidas cuentan en el día)");
  });

  it("presenta título, calorías, macros, descripción y una acción de edición", () => {
    expect(mealList).toContain("formatKcal(meal.final_calories)");
    expect(mealList).toContain("formatMealMacros(meal)");
    expect(mealList).toContain("meal.description");
    expect(mealList).toContain("<Pencil");
  });

  it("mantiene el estado vacío sin duplicar la CTA de creación", () => {
    expect(mealList).toContain("Todavía no cargaste comidas.");
    expect(mealList).not.toContain("Agregar comida");
  });

  it("pide confirmación antes del soft delete y permite cancelar sin mutar", () => {
    expect(mealList).toContain("¿Eliminar");
    expect(mealList).toContain("setDeleteTarget(null)");
    expect(mealList).toContain("softDeleteMealAction(formData)");
    expect(mealList).toContain("Eliminar comida");
    expect(mealList).toContain("Comida eliminada.");
    expect(actions).toContain("export async function softDeleteMealAction");
    expect(actions).toContain("await softDeleteMeal(id)");
    expect(dayLog).toContain(".update({ deleted_at: new Date().toISOString() })");
  });

  it("mantiene el editor abierto ante error y expone sólo mensajes públicos", () => {
    expect(mealList).toContain("No pudimos guardar los cambios. Intentá nuevamente.");
    expect(mealList).toContain("No pudimos eliminar la comida. Intentá nuevamente.");
    expect(actions).toContain("[today] update_meal_failed");
    expect(actions).toContain("[today] soft_delete_meal_failed");
  });
});
