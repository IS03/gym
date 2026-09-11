import type { NutritionReportPreset, NutritionReportRange } from "./reports-core";

export type NutritionReportComparisonMode = "previous" | "period" | "goal" | null;

export function nutritionReportComparisonMode(value: string | null | undefined): NutritionReportComparisonMode {
  return value === "previous" || value === "period" || value === "goal" ? value : null;
}

export function nutritionReportPath(input: {
  preset: NutritionReportPreset;
  start: string;
  end: string;
  comparison?: NutritionReportComparisonMode;
  basePath?: string;
  query?: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams({ period: input.preset });
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value) params.set(key, value);
  }
  if (input.preset === "custom") {
    params.set("from", input.start);
    params.set("to", input.end);
  }
  if (input.comparison) params.set("compare", input.comparison);
  return `${input.basePath ?? "/today/reports"}?${params.toString()}`;
}

export function nutritionReportCurrentPath(range: NutritionReportRange, input: { basePath?: string; query?: Record<string, string | undefined> } = {}) {
  return nutritionReportPath({ ...range, ...input, comparison: null });
}

export function nutritionReportPreviousPath(range: NutritionReportRange, input: { basePath?: string; query?: Record<string, string | undefined> } = {}) {
  return nutritionReportPath({ ...range, ...input, comparison: "previous" });
}
