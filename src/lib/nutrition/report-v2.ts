import type { NutritionReportDay } from "./reports-core";

export type NutritionReportDayHighlight = {
  kind: "closest_target" | "largest_balance" | "highest_protein";
  title: string;
  day: NutritionReportDay;
};

function completedNutritionDays(days: readonly NutritionReportDay[]) {
  return days.filter((day) => day.isComplete && day.hasNutrition);
}

function minimumBy<T>(values: readonly T[], score: (value: T) => number) {
  return values.reduce<T | null>((best, value) => (
    best === null || score(value) < score(best) ? value : best
  ), null);
}

function maximumBy<T>(values: readonly T[], score: (value: T) => number) {
  return values.reduce<T | null>((best, value) => (
    best === null || score(value) > score(best) ? value : best
  ), null);
}

/**
 * Picks up to three distinct, completed days that explain the period. These are
 * descriptive milestones, never judgements about whether the result was good.
 */
export function buildNutritionReportDayHighlights(
  days: readonly NutritionReportDay[],
): NutritionReportDayHighlight[] {
  const completed = completedNutritionDays(days);
  const closestTarget = minimumBy(
    completed.filter((day) => day.targetDeviationKcal !== null),
    (day) => Math.abs(day.targetDeviationKcal!),
  );
  const largestBalance = maximumBy(
    completed.filter((day) => day.energyBalanceKcal !== null),
    (day) => Math.abs(day.energyBalanceKcal!),
  );
  const highestProtein = maximumBy(
    completed.filter((day) => day.proteinG !== null),
    (day) => day.proteinG!,
  );

  const candidates: Array<NutritionReportDayHighlight | null> = [
    closestTarget ? { kind: "closest_target", title: "Más cerca del objetivo", day: closestTarget } : null,
    largestBalance ? {
      kind: "largest_balance",
      title: largestBalance.energyBalanceKcal! < 0
        ? "Mayor déficit estimado"
        : largestBalance.energyBalanceKcal! > 0
          ? "Mayor superávit estimado"
          : "Balance más marcado",
      day: largestBalance,
    } : null,
    highestProtein ? { kind: "highest_protein", title: "Mayor proteína registrada", day: highestProtein } : null,
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate): candidate is NutritionReportDayHighlight => {
    if (!candidate || seen.has(candidate.day.date)) return false;
    seen.add(candidate.day.date);
    return true;
  }).slice(0, 3);
}
