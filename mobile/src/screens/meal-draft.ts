import {
  formatLocalizedDecimal,
  isLocalizedDecimalDraft,
} from "../../../src/lib/localized-decimal";
import {
  optionalMealMacro,
  requiredMealCalories,
} from "../../../src/lib/nutrition/meal-macros";
import type {
  MobileMealDto,
  MobileMealMutationPayload,
} from "../../../src/lib/mobile-api/contracts";

export type MealDraft = Omit<MobileMealMutationPayload, "idempotencyKey">;

export const EMPTY_MEAL_DRAFT: MealDraft = {
  title: "",
  description: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
};

export function mealDraftFromMeal(meal: MobileMealDto): MealDraft {
  return {
    title: meal.title ?? "",
    description: meal.description ?? "",
    calories: meal.calories === null ? "" : String(meal.calories),
    proteinG: formatLocalizedDecimal(meal.proteinG),
    carbsG: formatLocalizedDecimal(meal.carbsG),
    fatG: formatLocalizedDecimal(meal.fatG),
  };
}

export function acceptsMealNumericDraft(
  field: keyof Pick<MealDraft, "calories" | "proteinG" | "carbsG" | "fatG">,
  value: string,
) {
  return field === "calories"
    ? value.trim() === "" || /^\d+$/.test(value.trim())
    : isLocalizedDecimalDraft(value);
}

export function validateMealDraft(draft: MealDraft): string | null {
  try {
    requiredMealCalories(draft.calories);
    optionalMealMacro(draft.proteinG, "Proteína");
    optionalMealMacro(draft.carbsG, "Carbohidratos");
    optionalMealMacro(draft.fatG, "Grasas");
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Revisá los datos ingresados.";
  }
}
