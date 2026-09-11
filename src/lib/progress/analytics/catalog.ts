import {
  BODY_MEASUREMENT_LABELS,
  type BodyMeasurementField,
} from "../../body-measurement-types";
import type { MetricValueType, SystemMetricKey } from "../../daily-metrics/core";
import type { ProgressMetricDefinition } from "./types";

const nutritionSource = (field: string) => ({
  adapter: "nutrition_day" as const,
  canonicalTables: ["day_logs", "meal_entries"] as const,
  field,
});

const nutritionMetric = (
  input: Pick<ProgressMetricDefinition, "key" | "label" | "unit" | "aggregation" | "supportsGoal" | "relation"> & {
    field: string;
    category?: string;
    comparison?: ProgressMetricDefinition["comparison"];
    goal?: ProgressMetricDefinition["goal"];
  },
): ProgressMetricDefinition => ({
  key: input.key,
  domain: "nutrition",
  category: input.category ?? "intake",
  label: input.label,
  unit: input.unit,
  source: nutritionSource(input.field),
  temporalOrigin: "day",
  aggregation: input.aggregation,
  missingData: "exclude",
  coverageMode: "eligible_days",
  supportsGoal: input.supportsGoal,
  supportsTemporalComparison: true,
  minimumSamples: 1,
  comparisonScope: "same_metric",
  comparison: input.comparison ?? { allowPercentDelta: true, stablePercentThreshold: 3 },
  goal: input.goal,
  relation: input.relation,
  format: { maximumFractionDigits: input.unit === "g" ? 1 : 0 },
});

export const NUTRITION_PROGRESS_METRICS = [
  nutritionMetric({ key: "nutrition.calories", label: "Calorías consumidas", unit: "kcal", field: "calories", aggregation: "average", supportsGoal: true, goal: { rule: "reference", source: "historical_snapshot" }, relation: { model: "chronic", suggestedLagDays: [0, 7, 14], minimumWindowDays: 14 } }),
  nutritionMetric({ key: "nutrition.calorie_target", label: "Objetivo calórico", unit: "kcal", field: "targetCalories", aggregation: "average", supportsGoal: false, category: "target", relation: { model: "chronic", suggestedLagDays: [0], minimumWindowDays: 14 } }),
  nutritionMetric({ key: "nutrition.protein", label: "Proteína", unit: "g", field: "proteinG", aggregation: "average", supportsGoal: true, goal: { rule: "minimum", source: "historical_snapshot" }, relation: { model: "chronic", suggestedLagDays: [7, 14, 28], minimumWindowDays: 28 } }),
  nutritionMetric({ key: "nutrition.carbs", label: "Carbohidratos", unit: "g", field: "carbsG", aggregation: "average", supportsGoal: false, relation: { model: "acute", suggestedLagDays: [0, 1], minimumWindowDays: 14 } }),
  nutritionMetric({ key: "nutrition.fat", label: "Grasas", unit: "g", field: "fatG", aggregation: "average", supportsGoal: false, relation: { model: "chronic", suggestedLagDays: [0, 7], minimumWindowDays: 14 } }),
  nutritionMetric({ key: "nutrition.expenditure", label: "Gasto estimado", unit: "kcal", field: "expenditureKcal", aggregation: "average", supportsGoal: false, category: "energy", relation: { model: "chronic", suggestedLagDays: [0, 7], minimumWindowDays: 14 } }),
  nutritionMetric({ key: "nutrition.energy_balance", label: "Balance energético", unit: "kcal", field: "energyBalanceKcal", aggregation: "sum", supportsGoal: false, category: "energy", comparison: { allowPercentDelta: false, stablePercentThreshold: 3, stableAbsoluteThreshold: 50, signSemantic: "energy_balance" }, relation: { model: "chronic", suggestedLagDays: [7, 14, 28], minimumWindowDays: 28 } }),
] as const satisfies readonly ProgressMetricDefinition[];

const bodyMetric = (field: "weight_kg" | BodyMeasurementField, label: string): ProgressMetricDefinition => ({
  key: field === "weight_kg" ? "body.weight" : `body.${field.replace(/_cm$/, "")}`,
  domain: "body",
  category: field === "weight_kg" ? "weight" : "measurement",
  label,
  unit: field === "weight_kg" ? "kg" : "cm",
  source: {
    adapter: field === "weight_kg" ? "weight_history" : "body_measurement",
    canonicalTables: field === "weight_kg" ? ["day_logs"] : ["body_measurements"],
    field,
  },
  temporalOrigin: "measurement",
  aggregation: "change",
  missingData: "exclude",
  coverageMode: "samples_only",
  supportsGoal: false,
  supportsTemporalComparison: true,
  minimumSamples: 2,
  comparisonScope: "same_metric",
  comparison: { allowPercentDelta: false, stablePercentThreshold: 3 },
  relation: { model: "chronic", suggestedLagDays: [7, 14, 28], minimumWindowDays: 28 },
  format: { maximumFractionDigits: 2 },
});

export const BODY_PROGRESS_METRICS = [
  bodyMetric("weight_kg", "Peso"),
  ...Object.entries(BODY_MEASUREMENT_LABELS).map(([field, label]) => bodyMetric(field as BodyMeasurementField, label)),
] as const satisfies readonly ProgressMetricDefinition[];

const trainingLoadMetric = (
  key: string,
  label: string,
  unit: string,
  field: string,
): ProgressMetricDefinition => ({
  key,
  domain: "training",
  category: "load",
  label,
  unit,
  source: { adapter: "training_load", canonicalTables: ["workout_sessions", "workout_session_exercises", "workout_sets"], field },
  temporalOrigin: field === "sets" || field === "volumeKg" ? "set" : "session",
  aggregation: "sum",
  missingData: "zero_when_no_event",
  coverageMode: "event_stream",
  supportsGoal: false,
  supportsTemporalComparison: true,
  minimumSamples: 1,
  comparisonScope: "same_metric",
  comparison: { allowPercentDelta: true, stablePercentThreshold: 3 },
  relation: { model: "chronic", suggestedLagDays: [0, 7], minimumWindowDays: 14 },
  format: { maximumFractionDigits: 0 },
});

const performanceMetric = (
  key: string,
  label: string,
  unit: string | null,
  field: string,
  aggregation: ProgressMetricDefinition["aggregation"] = "best",
): ProgressMetricDefinition => ({
  key,
  domain: "training",
  category: "performance",
  label,
  unit,
  source: { adapter: "exercise_performance", canonicalTables: ["exercises", "workout_sessions", "workout_session_exercises", "workout_sets"], field },
  temporalOrigin: "session",
  aggregation,
  missingData: "exclude",
  coverageMode: "samples_only",
  supportsGoal: false,
  supportsTemporalComparison: true,
  minimumSamples: 1,
  comparisonScope: "same_exercise_and_weight_mode",
  comparison: { allowPercentDelta: false, stablePercentThreshold: 3 },
  relation: { model: "chronic", suggestedLagDays: [7, 14, 28], minimumWindowDays: 28 },
  format: { maximumFractionDigits: unit === "kg" ? 2 : 0 },
  metadata: { requiresExerciseContext: true, respectsWeightMode: true },
});

export const TRAINING_PROGRESS_METRICS = [
  trainingLoadMetric("training.load.sessions", "Sesiones", "sesiones", "sessions"),
  trainingLoadMetric("training.load.sets", "Series", "series", "sets"),
  trainingLoadMetric("training.load.duration", "Duración", "min", "minutes"),
  trainingLoadMetric("training.load.volume", "Volumen", "kg", "volumeKg"),
  performanceMetric("training.performance.best_weight", "Mejor peso", "kg", "bestWeightKg"),
  performanceMetric("training.performance.best_reps", "Mejores repeticiones", "reps", "bestReps"),
  performanceMetric("training.performance.reps_same_load", "Repeticiones a igual carga", "reps", "repsAtSameLoad"),
  performanceMetric("training.performance.best_set", "Mejor serie", null, "bestSet"),
  performanceMetric("training.performance.session_volume", "Volumen por sesión", "kg", "sessionVolumeKg"),
  performanceMetric("training.performance.prs", "PRs", "PRs", "personalRecords", "sum"),
] as const satisfies readonly ProgressMetricDefinition[];

export type DynamicMetricDefinitionInput = {
  id: string;
  system_key: SystemMetricKey | null;
  name: string;
  unit: string | null;
  value_type: MetricValueType;
  target_value: number | null;
  sort_order: number;
  is_active: boolean;
  archived_at: string | null;
};

export function adaptDailyMetricDefinition(metric: DynamicMetricDefinitionInput): ProgressMetricDefinition {
  return {
    key: `activity.daily.${metric.id}`,
    domain: "activity",
    category: "daily_metric",
    label: metric.name,
    unit: metric.unit,
    source: { adapter: "daily_metric", canonicalTables: ["user_metrics", "daily_metric_values"], field: metric.id },
    temporalOrigin: "day",
    aggregation: "average",
    missingData: "exclude",
    coverageMode: "eligible_days",
    supportsGoal: metric.target_value !== null,
    supportsTemporalComparison: true,
    minimumSamples: 2,
    comparisonScope: "same_metric",
    comparison: { allowPercentDelta: true, stablePercentThreshold: 3 },
    goal: metric.target_value === null ? undefined : { rule: "minimum", source: "current_reference" },
    relation: { model: "configurable", suggestedLagDays: [0, 1, 7, 14], minimumWindowDays: 14 },
    format: { maximumFractionDigits: metric.value_type === "integer" || metric.value_type === "duration" ? 0 : 4 },
    metadata: {
      definitionId: metric.id,
      systemKey: metric.system_key,
      valueType: metric.value_type,
      targetValue: metric.target_value,
      sortOrder: metric.sort_order,
      isActive: metric.is_active,
      archivedAt: metric.archived_at,
    },
  };
}

export function buildProgressMetricCatalog(
  dynamicMetrics: readonly DynamicMetricDefinitionInput[] = [],
): ProgressMetricDefinition[] {
  return [
    ...NUTRITION_PROGRESS_METRICS,
    ...dynamicMetrics.map(adaptDailyMetricDefinition),
    ...BODY_PROGRESS_METRICS,
    ...TRAINING_PROGRESS_METRICS,
  ];
}

export function getProgressMetricDefinition(
  key: string,
  catalog: readonly ProgressMetricDefinition[],
): ProgressMetricDefinition | null {
  return catalog.find((metric) => metric.key === key) ?? null;
}
