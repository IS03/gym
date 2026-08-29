import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const mealCreate = source("src/app/(app)/today/create-meal-form.tsx");
const mealEdit = source("src/app/(app)/today/meal-list.tsx");
const sessionEditor = source("src/app/(app)/train/session/[id]/session-editor.tsx");
const routineEditor = source("src/app/(app)/train/routines/[id]/routine-template-editor.tsx");
const correction = source("src/app/(app)/train/session/[id]/correct/session-correction-form.tsx");
const goals = source("src/app/(app)/settings/nutrition/nutrition-settings-forms.tsx");

describe("PR 10.7.1 — inputs decimales localizados", () => {
  it("uses textual decimal macros in both meal flows", () => {
    for (const form of [mealCreate, mealEdit]) {
      expect(form).toContain('name="final_protein_g"');
      expect(form).toContain('name="final_carbs_g"');
      expect(form).toContain('name="final_fat_g"');
      expect(form).toContain('type="text"');
      expect(form).toContain('pattern="[0-9]*[.,]?[0-9]*"');
    }
  });

  it("uses the controlled localized primitive for training weights", () => {
    expect(sessionEditor).toContain("<LocalizedDecimalInput");
    expect(routineEditor).toContain("<LocalizedDecimalInput");
    expect(correction).toContain("<LocalizedDecimalInput");
    expect(sessionEditor).not.toContain('actual_weight_kg ?? ""');
    expect(routineEditor).not.toContain('Peso objetivo de serie ${setIndex + 1}`} type="number"');
  });

  it("keeps only protein and water as localized settings decimals", () => {
    expect(goals).toContain('type={decimal ? "text" : "number"}');
    expect(goals).toContain('inputMode={decimal ? "decimal" : "numeric"}');
    expect(goals).toContain('name="calories_no_gym"');
  });
});
