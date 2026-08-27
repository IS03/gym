import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("quick meals wiring", () => {
  const composer = read("src/app/(app)/today/meal-composer.tsx");
  const quickMeals = read("src/app/(app)/today/quick-meals.tsx");
  const actions = read("src/app/(app)/today/actions.ts");
  const dayLog = read("src/lib/phase1/day-log.ts");
  const todayPage = read("src/app/(app)/today/page.tsx");

  it("keeps the manual CTA and only renders quick meals when candidates exist", () => {
    expect(composer).toContain("Agregar comida");
    expect(composer).toContain("<QuickMeals meals={quickMeals} />");
    expect(quickMeals).toContain("if (meals.length === 0) return null");
  });

  it("shows four initially, exposes compact accessible quick add, pending and inline errors", () => {
    expect(quickMeals).toContain("meals.slice(0, QUICK_MEALS_INITIAL_LIMIT)");
    expect(quickMeals).toContain("aria-label={`Agregar ${meal.label}`}");
    expect(quickMeals).toContain("disabled={pending}");
    expect(quickMeals).toContain("pendingSourceMealId.current");
    expect(quickMeals).toContain('role="status"');
    expect(quickMeals).toContain('aria-live="polite"');
    expect(quickMeals).toContain("<ResponsiveDialog");
  });

  it("uses a parallel read and sends only sourceMealId to a server-owned copy", () => {
    expect(todayPage).toContain("getQuickMealCandidates(today, auth)");
    expect(quickMeals).toContain("quickAddMealAction(meal.sourceMealId)");
    expect(actions).toContain("requireAuthenticatedRequestContext()");
    expect(actions).toContain("quickAddMeal(sourceMealId, todayInCordoba(), auth)");
    expect(dayLog).toContain('.eq("id", sourceMealId)');
    expect(dayLog).toContain('.eq("user_id", userId)');
    expect(dayLog).toContain('.eq("source_type", "manual")');
    expect(dayLog).toContain("return createMeal({");
  });

  it("keeps quick-add separate from manual duplicate detection and copies only canonical meal fields", () => {
    const quickAction = actions.slice(actions.indexOf("export async function quickAddMealAction"), actions.indexOf("function parseCreateMealFromFormData"));
    expect(quickAction).not.toContain("findRecentPossibleDuplicateMeal");
    const quickCopy = dayLog.slice(dayLog.indexOf("export async function quickAddMeal"), dayLog.indexOf("export type UpdateMealInput"));
    expect(quickCopy).toContain("title: data.title");
    expect(quickCopy).toContain("final_fat_g: data.final_fat_g");
    expect(quickCopy).not.toContain("day_log_id:");
    expect(quickCopy).not.toContain("created_at:");
  });
});
