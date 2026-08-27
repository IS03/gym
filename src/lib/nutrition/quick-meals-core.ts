import { normalizeMealText } from "./meal-macros";

export const QUICK_MEAL_WINDOW_DAYS = 60;
export const QUICK_MEALS_INITIAL_LIMIT = 4;
export const QUICK_MEALS_MAX = 10;

export type QuickMealFact = {
  id: string;
  logDate: string;
  title: string | null;
  description: string | null;
  finalCalories: number | null;
  finalProteinG: number | null;
  finalCarbsG: number | null;
  finalFatG: number | null;
  createdAt: string;
  deletedAt?: string | null;
  entryKind?: string | null;
  sourceType?: string | null;
};

export type QuickMealCandidate = {
  sourceMealId: string;
  label: string;
  title: string | null;
  description: string | null;
  finalCalories: number;
  finalProteinG: number | null;
  finalCarbsG: number | null;
  finalFatG: number | null;
  useCount: number;
  lastUsedDate: string;
  lastCreatedAt: string;
  key: string;
};

export function quickMealWindow(today: string): { start: string; end: string } {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - QUICK_MEAL_WINDOW_DAYS);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function macroIdentity(value: number | null): string {
  return value === null ? "null" : `number:${value}`;
}

export function isQuickMealEligible(meal: QuickMealFact): boolean {
  if (meal.deletedAt != null) return false;
  if (meal.entryKind !== undefined && meal.entryKind !== "meal") return false;
  if (meal.sourceType !== undefined && meal.sourceType !== "manual") return false;
  return meal.finalCalories !== null
    && Number.isFinite(meal.finalCalories)
    && (normalizeMealText(meal.title) !== null || normalizeMealText(meal.description) !== null);
}

export function quickMealIdentity(meal: QuickMealFact): string | null {
  if (!isQuickMealEligible(meal)) return null;
  return JSON.stringify([
    normalizeMealText(meal.title),
    normalizeMealText(meal.description),
    macroIdentity(meal.finalCalories),
    macroIdentity(meal.finalProteinG),
    macroIdentity(meal.finalCarbsG),
    macroIdentity(meal.finalFatG),
  ]);
}

function isLater(left: QuickMealFact, right: QuickMealFact): boolean {
  if (left.logDate !== right.logDate) return left.logDate > right.logDate;
  return left.createdAt > right.createdAt;
}

export function buildQuickMealCandidates(
  facts: QuickMealFact[],
  limit = QUICK_MEALS_MAX,
): QuickMealCandidate[] {
  const groups = new Map<string, { representative: QuickMealFact; useCount: number }>();
  for (const fact of facts) {
    const key = quickMealIdentity(fact);
    if (!key) continue;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { representative: fact, useCount: 1 });
      continue;
    }
    group.useCount += 1;
    if (isLater(fact, group.representative)) group.representative = fact;
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const meal = group.representative;
      return {
        sourceMealId: meal.id,
        label: meal.title?.trim() || meal.description?.trim() || "",
        title: meal.title,
        description: meal.description,
        finalCalories: meal.finalCalories as number,
        finalProteinG: meal.finalProteinG,
        finalCarbsG: meal.finalCarbsG,
        finalFatG: meal.finalFatG,
        useCount: group.useCount,
        lastUsedDate: meal.logDate,
        lastCreatedAt: meal.createdAt,
        key,
      };
    })
    .sort((left, right) =>
      right.useCount - left.useCount
      || right.lastUsedDate.localeCompare(left.lastUsedDate)
      || right.lastCreatedAt.localeCompare(left.lastCreatedAt)
      || left.key.localeCompare(right.key))
    .slice(0, limit);
}
