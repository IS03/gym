import type { NutritionReportPreset, NutritionReportRange } from "./reports-core";

export type NutritionReportComparisonMode = "previous" | null;

export function nutritionReportComparisonMode(value: string | null | undefined): NutritionReportComparisonMode {
  return value === "previous" ? "previous" : null;
}

export function nutritionReportPath(input: {
  preset: NutritionReportPreset;
  start: string;
  end: string;
  comparison?: NutritionReportComparisonMode;
  basePath?: string;
}) {
  const params = new URLSearchParams({ period: input.preset });
  if (input.preset === "custom") {
    params.set("from", input.start);
    params.set("to", input.end);
  }
  if (input.comparison === "previous") params.set("compare", "previous");
  return `${input.basePath ?? "/today/reports"}?${params.toString()}`;
}

export function nutritionReportCurrentPath(range: NutritionReportRange) {
  return nutritionReportPath({ ...range, comparison: null });
}

export function nutritionReportPreviousPath(range: NutritionReportRange) {
  return nutritionReportPath({ ...range, comparison: "previous" });
}
