import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("PR30.1 — Agregar rápido compacto", () => {
  const composer = read("src/app/(app)/today/meal-composer.tsx");
  const quickAdd = read("src/app/(app)/today/quick-meals.tsx");
  const actions = read("src/app/(app)/today/actions.ts");
  const savedDomain = read("src/lib/nutrition/saved-meals.ts");
  const quickDomain = read("src/lib/nutrition/quick-meals.ts");
  const quickCore = read("src/lib/nutrition/quick-meals-core.ts");
  const todayPage = read("src/app/(app)/today/page.tsx");

  it("mantiene Agregar comida y muestra Agregar rápido como acceso compacto", () => {
    expect(composer).toContain("Agregar comida");
    expect(composer).toContain("<QuickAddMeals");
    expect(quickAdd).toContain("Agregar rápido");
    expect(quickAdd).toContain('aria-haspopup="dialog"');
    expect(quickAdd).toContain("<ResponsiveDialog open={quickAddOpen}");
    expect(quickAdd).not.toContain("return <section");
    expect(quickAdd).toContain('tabButton("saved", "Habituales")');
    expect(quickAdd).toContain('tabButton("suggested", "Sugeridas")');
  });

  it("muestra la colección completa dentro del sheet, sin Ver más permanente", () => {
    expect(quickAdd).toContain("filteredSavedMeals");
    expect(quickAdd).toContain("filteredSuggestedMeals");
    expect(quickAdd).not.toContain("QUICK_MEALS_INITIAL_LIMIT");
    expect(quickAdd).not.toContain("Ver más");
    expect(quickAdd).toContain('aria-live="polite"');
    expect(quickAdd).toContain("pendingRef.current");
    expect(quickAdd).toContain("Agregada");
  });

  it("busca en la pestaña abierta sin pedir datos por tecla y permite limpiar", () => {
    expect(quickAdd).toContain('id="quick-add-search"');
    expect(quickAdd).toContain("filterQuickAddItems(savedMeals, search");
    expect(quickAdd).toContain("filterQuickAddItems(suggestedMeals, search");
    expect(quickAdd).toContain('aria-label="Limpiar búsqueda"');
    expect(quickAdd).toContain('setSearch("")');
    expect(quickAdd).toContain("No encontramos comidas habituales con esa búsqueda.");
    expect(quickAdd).toContain("No encontramos comidas sugeridas con esa búsqueda.");
  });

  it("carga Habituales en paralelo sin reemplazar el read-model de Sugeridas", () => {
    expect(todayPage).toContain("getQuickMealCandidates(today, auth)");
    expect(todayPage).toContain("listActiveSavedMeals(auth)");
    expect(todayPage).toContain("Promise.all");
    expect(quickDomain).toContain('eq("source_type", "manual")');
    expect(quickCore).toContain("QUICK_MEAL_WINDOW_DAYS = 60");
    expect(quickCore).toContain("QUICK_MEALS_MAX = 10");
  });

  it("conserva el + sugerido y agrega Guardar como habitual como acción distinta", () => {
    expect(quickAdd).toContain("quickAddMealAction(meal.sourceMealId)");
    expect(quickAdd).toContain("saveSuggestedMealAction(meal.sourceMealId)");
    expect(quickAdd).toContain("Guardar ${meal.label} como habitual");
    expect(actions).toContain("saveSuggestedMeal(sourceMealId, todayInCordoba(), auth)");
    expect(savedDomain).toContain('.eq("id", sourceMealId).eq("user_id", auth.userId)');
    expect(savedDomain).toContain('.is("deleted_at", null)');
  });

  it("one-tap y Ajustar envían IDs/cantidades y el servidor relee snapshots", () => {
    expect(quickAdd).toContain("quickAddSavedMealAction({ savedMealId: meal.id, date })");
    expect(quickAdd).toContain("itemId: item.id, quantity:");
    expect(quickAdd).not.toContain("final_calories:");
    expect(actions).toContain("quickAddSavedMeal(input.savedMealId, input.date, auth)");
    expect(actions).toContain("addAdjustedSavedMeal(input, auth)");
    expect(savedDomain).toContain("readSavedMeal(savedMealId, auth, true)");
    expect(savedDomain).toContain("scaleSavedMealItem(item, byId.get(item.id))");
  });

  it("ofrece empty states de ambos conceptos sin auto-guardar sugerencias", () => {
    expect(quickAdd).toContain("Todavía no guardaste comidas habituales.");
    expect(quickAdd).toContain("Todavía no hay suficientes comidas anteriores para sugerir.");
    expect(quickAdd).toContain("Administrar comidas");
    expect(quickAdd).toContain("defaultQuickAddTab(savedMeals.length, suggestedMeals.length)");
    expect(savedDomain).not.toContain("buildQuickMealCandidates");
  });
});
