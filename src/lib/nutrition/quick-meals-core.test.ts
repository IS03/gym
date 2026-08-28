import { describe, expect, it } from "vitest";
import {
  buildQuickMealCandidates,
  QUICK_MEALS_MAX,
  quickMealWindow,
  type QuickMealFact,
} from "./quick-meals-core";

function meal(overrides: Partial<QuickMealFact> = {}): QuickMealFact {
  return {
    id: "meal-1",
    logDate: "2026-08-20",
    title: "Panqueques",
    description: "Con banana",
    finalCalories: 370,
    finalProteinG: 36,
    finalCarbsG: 32,
    finalFatG: 11,
    createdAt: "2026-08-20T12:00:00.000Z",
    deletedAt: null,
    entryKind: "meal",
    sourceType: "manual",
    ...overrides,
  };
}

describe("quick meals read model", () => {
  it("groups exact equivalent meals after normalizing whitespace and case", () => {
    const candidates = buildQuickMealCandidates([
      meal(),
      meal({ id: "meal-2", title: "  panqueques ", description: "CON   BANANA", logDate: "2026-08-21" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ sourceMealId: "meal-2", useCount: 2, label: "panqueques" });
  });

  it("does not group same title when macros or description differ, including null versus zero", () => {
    const candidates = buildQuickMealCandidates([
      meal(),
      meal({ id: "macro-different", finalCalories: 520 }),
      meal({ id: "description-different", description: "Con dulce" }),
      meal({ id: "macro-null", finalProteinG: null }),
      meal({ id: "macro-zero", finalProteinG: 0 }),
    ]);

    expect(candidates).toHaveLength(5);
  });

  it("only accepts active manual meal entries with a recognizable label", () => {
    const candidates = buildQuickMealCandidates([
      meal(),
      meal({ id: "deleted", deletedAt: "2026-08-21T00:00:00Z" }),
      meal({ id: "imported", sourceType: "sheet_import" }),
      meal({ id: "summary", entryKind: "legacy_daily_summary" }),
      meal({ id: "blank", title: "  ", description: null }),
      meal({ id: "description-only", title: null, description: "Yogur" }),
    ]);

    expect(candidates.map((candidate) => candidate.sourceMealId)).toEqual(["meal-1", "description-only"]);
  });

  it("ranks by uses, then most recent usage, then created_at, then a stable key", () => {
    const candidates = buildQuickMealCandidates([
      meal({ id: "frequent-old", title: "A", logDate: "2026-08-10" }),
      meal({ id: "frequent-new", title: "A", logDate: "2026-08-11", createdAt: "2026-08-11T12:00:00Z" }),
      meal({ id: "recent", title: "B", logDate: "2026-08-25", createdAt: "2026-08-25T12:00:00Z" }),
      meal({ id: "same-date-new", title: "C", logDate: "2026-08-24", createdAt: "2026-08-24T13:00:00Z" }),
      meal({ id: "same-date-old", title: "D", logDate: "2026-08-24", createdAt: "2026-08-24T12:00:00Z" }),
    ]);

    expect(candidates.map((candidate) => candidate.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("enforces the maximum and defines exactly the 60 complete days before today", () => {
    const candidates = buildQuickMealCandidates(
      Array.from({ length: QUICK_MEALS_MAX + 2 }, (_, index) => meal({ id: `m-${index}`, title: `M ${index}` })),
    );
    expect(candidates).toHaveLength(QUICK_MEALS_MAX);
    expect(quickMealWindow("2026-08-27")).toEqual({ start: "2026-06-28", end: "2026-08-26" });
  });
});
