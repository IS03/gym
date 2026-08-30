import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  nullableMealMacrosMatch,
  optionalMealMacro,
  requiredMealCalories,
} from "./meal-macros";

describe("manual meal macro validation", () => {
  it("keeps optional null and known zero distinct", () => {
    expect(optionalMealMacro("", "Proteína")).toBeNull();
    expect(optionalMealMacro(null, "Carbohidratos")).toBeNull();
    expect(optionalMealMacro("0", "Grasas")).toBe(0);
    expect(nullableMealMacrosMatch(null, null)).toBe(true);
    expect(nullableMealMacrosMatch(null, 0)).toBe(false);
  });

  it("accepts comma or point macros and keeps required calories whole", () => {
    expect(requiredMealCalories("620")).toBe(620);
    expect(optionalMealMacro("49,9", "Proteína")).toBe(49.9);
    expect(optionalMealMacro("49.9", "Proteína")).toBe(49.9);
    expect(optionalMealMacro("69,3", "Carbohidratos")).toBe(69.3);
    expect(optionalMealMacro("9,0", "Grasas")).toBe(9);
    expect(optionalMealMacro("45.5", "Proteína")).toBe(45.5);
    expect(optionalMealMacro("72", "Carbohidratos")).toBe(72);
    expect(optionalMealMacro("14", "Grasas")).toBe(14);
  });

  it.each([
    ["Proteína", -1],
    ["Carbohidratos", "-0.1"],
    ["Grasas", Number.NEGATIVE_INFINITY],
    ["Proteína", Number.NaN],
    ["Carbohidratos", "no-es-un-numero"],
  ] as const)("rejects invalid %s values", (field, value) => {
    expect(() => optionalMealMacro(value, field)).toThrow();
  });

  it.each([null, "", 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid required calories: %s",
    (value) => {
      expect(() => requiredMealCalories(value)).toThrow();
    },
  );

  it.each(["567.5", "567,5", "12,5,2", "1.234,56", "1e3"])(
    "rejects non-integer or ambiguous calories: %s",
    (value) => {
      expect(() => requiredMealCalories(value)).toThrow();
    },
  );

  it("compares numeric macros with tolerance without collapsing null into zero", () => {
    expect(nullableMealMacrosMatch(30, 30.009)).toBe(true);
    expect(nullableMealMacrosMatch(30, 30.02)).toBe(false);
    expect(nullableMealMacrosMatch(0, 0)).toBe(true);
    expect(nullableMealMacrosMatch(undefined, null)).toBe(true);
  });
});

describe("manual meal application wiring", () => {
  const dayLogSource = readFileSync("src/lib/phase1/day-log.ts", "utf8");
  const actionSource = readFileSync("src/app/(app)/today/actions.ts", "utf8");
  const createFormSource = readFileSync(
    "src/app/(app)/today/create-meal-form.tsx",
    "utf8",
  );
  const todaySource = readFileSync("src/app/(app)/today/page.tsx", "utf8");
  const mealListSource = readFileSync("src/app/(app)/today/meal-list.tsx", "utf8");
  const historySource = readFileSync("src/app/(app)/history/page.tsx", "utf8");
  const homeSource = readFileSync("src/app/(app)/home/page.tsx", "utf8");

  it("persists all four values with manual meal semantics", () => {
    expect(dayLogSource).toContain("final_carbs_g: carbs");
    expect(dayLogSource).toContain("final_fat_g: fat");
    expect(dayLogSource).toContain('source_type: "manual"');
    expect(dayLogSource).toContain('entry_kind: "meal"');
  });

  it("includes carbs and fat in duplicate detection", () => {
    expect(dayLogSource).toContain(
      "nullableMealMacrosMatch(input.final_carbs_g, m.final_carbs_g)",
    );
    expect(dayLogSource).toContain(
      "nullableMealMacrosMatch(input.final_fat_g, m.final_fat_g)",
    );
    expect(actionSource).toContain("final_carbs_g: carbs");
    expect(actionSource).toContain("final_fat_g: fat");
  });

  it("renders and edits all four fields", () => {
    for (const name of [
      "final_calories",
      "final_protein_g",
      "final_carbs_g",
      "final_fat_g",
    ]) {
      expect(createFormSource).toContain(`name="${name}"`);
      expect(mealListSource).toContain(`name="${name}"`);
    }
  });

  it("uses persisted aggregates and keeps History read-only", () => {
    expect(todaySource).toContain("dayLog.total_carbs_g");
    expect(todaySource).toContain("dayLog.total_fat_g");
    expect(historySource).toContain("dayLog.total_carbs_g");
    expect(historySource).toContain("dayLog.total_fat_g");
    expect(historySource).toContain("createIfMissing: false");
    expect(todaySource).not.toContain("target_kcal_snapshot");
    expect(historySource).not.toContain("target_kcal_snapshot");
    expect(homeSource).not.toContain("target_kcal_snapshot");
  });

  it("revalidates every dependent page after each mutation", () => {
    expect(actionSource).toContain('revalidatePath("/today")');
    expect(actionSource).toContain('revalidatePath("/history")');
    expect(actionSource).toContain('revalidatePath("/home")');
    expect(actionSource.match(/revalidateMealPages\(\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(actionSource).toContain("quickAddSavedMealAction");
    expect(actionSource).toContain("addAdjustedSavedMealAction");
  });

  it("usa la fecha elegida para crear, detectar duplicados y mover la misma comida", () => {
    expect(createFormSource).toContain('name="date"');
    expect(createFormSource).toContain("defaultValue={date}");
    expect(createFormSource).not.toContain('fd.set("date", date)');
    expect(actionSource).toContain('formData.get("date")');
    expect(mealListSource).toContain('name="date"');
    expect(dayLogSource).toContain("patch.day_log_id = destinationDay.id");
    expect(dayLogSource).not.toContain("delete().eq(\"id\", input.id)");
    expect(dayLogSource).not.toContain("legacy_import_source =");
  });
});
