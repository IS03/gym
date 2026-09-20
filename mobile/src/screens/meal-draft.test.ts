import { describe, expect, it } from "vitest";

import {
  acceptsMealNumericDraft,
  EMPTY_MEAL_DRAFT,
  mealDraftFromMeal,
  validateMealDraft,
} from "./meal-draft";

describe("native meal draft", () => {
  it("accepts localized decimal drafts for macros and whole calories", () => {
    expect(acceptsMealNumericDraft("proteinG", "120,5")).toBe(true);
    expect(acceptsMealNumericDraft("proteinG", "120.5")).toBe(true);
    expect(acceptsMealNumericDraft("calories", "120")).toBe(true);
    expect(acceptsMealNumericDraft("calories", "120,5")).toBe(false);
    expect(acceptsMealNumericDraft("fatG", "-1")).toBe(false);
  });

  it("validates required calories without requiring optional macros or title", () => {
    expect(
      validateMealDraft({ ...EMPTY_MEAL_DRAFT, calories: "420" }),
    ).toBeNull();
    expect(validateMealDraft(EMPTY_MEAL_DRAFT)).toContain("calorías");
    expect(
      validateMealDraft({
        ...EMPTY_MEAL_DRAFT,
        calories: "420",
        proteinG: "abc",
      }),
    ).toContain("Proteína");
  });

  it("preserves null macros as blank editable fields", () => {
    expect(
      mealDraftFromMeal({
        id: "meal",
        title: null,
        description: null,
        calories: 420,
        proteinG: 30.5,
        carbsG: null,
        fatG: 10,
        consumedAt: "2026-09-20T12:00:00Z",
        updatedAt: "2026-09-20T12:00:00Z",
      }),
    ).toEqual({
      title: "",
      description: "",
      calories: "420",
      proteinG: "30,5",
      carbsG: "",
      fatG: "10",
    });
  });
});
