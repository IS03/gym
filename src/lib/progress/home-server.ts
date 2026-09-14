import "server-only";

import { listBodyMeasurements } from "@/lib/body-measurements";
import { getDailyMetricsReport } from "@/lib/daily-metrics/reports";
import { getNutritionReportWithProgressComparison } from "@/lib/nutrition/reports";
import { listWeightHistory } from "@/lib/phase1/day-log";
import { getMyProfile } from "@/lib/phase1/profile";
import { isTrainingAnalysisPeriod, type TrainingAnalysisPeriod } from "@/lib/phase2/training-analysis";
import { getTrainingGeneralAnalysis } from "@/lib/phase2/training-robust";
import { resolveProgressPeriod, type ProgressResolvedPeriod } from "@/lib/progress/analytics";
import { buildBodyProgressReport } from "@/lib/progress/body";
import type { ProgressComparisonQuery, ProgressTemporalComparisonReference } from "@/lib/progress/comparisons";
import { buildProgressHomeModel, progressHomePeriodQuery } from "@/lib/progress/home";
import { getHighlightedRelationshipsForUser } from "@/lib/progress/relationships/server";
import { measurePerformance, type RequestPerformanceContext } from "@/lib/request-performance";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";

const previousComparison: ProgressComparisonQuery = {
  referenceType: "previous_period",
  referencePreset: null,
  referenceFrom: null,
  referenceTo: null,
  selectedMetricKeys: [],
  activeMetricKey: null,
  initialView: "insights",
};

async function isolated<T>(
  operation: string,
  task: () => Promise<T>,
  requestPerformance?: RequestPerformanceContext,
): Promise<T | null> {
  try {
    return await measurePerformance(
      {
        route: "/progress",
        operation,
        layer: "database",
        ...requestPerformance,
      },
      task,
    );
  } catch {
    return null;
  }
}

function trainingPeriod(period: ProgressResolvedPeriod): { preset: TrainingAnalysisPeriod; range?: { start: string; end: string } } {
  if (isTrainingAnalysisPeriod(period.preset)) return { preset: period.preset };
  return { preset: "custom", range: period.current };
}

export async function getProgressHomeData(
  input: { period?: string; from?: string; to?: string },
  today: string,
  auth: AuthenticatedRequestContext,
) {
  const period = resolveProgressPeriod({ preset: input.period ?? "4w", from: input.from, to: input.to }, today);
  const trainingInput = trainingPeriod(period);
  const trainingReference: ProgressTemporalComparisonReference = {
    type: "previous_period",
    period: period.previous,
    label: "Período anterior",
  };
  const nutritionPeriod = progressHomePeriodQuery("nutrition", period);
  const activityPeriod = progressHomePeriodQuery("activity", period);
  const relationshipPeriod = progressHomePeriodQuery("relationships", period);

  const [training, nutrition, activity, body, relationships] = await Promise.all([
    isolated("progress.training", () => getTrainingGeneralAnalysis(
      trainingInput.preset,
      trainingReference,
      {},
      trainingInput.range,
      auth,
    ), auth.requestPerformance),
    isolated("progress.nutrition", () => getNutritionReportWithProgressComparison({
      ...nutritionPeriod,
      comparison: previousComparison,
    }, today, auth), auth.requestPerformance),
    isolated("progress.activity-values", () => getDailyMetricsReport({
      ...activityPeriod,
      progressComparison: previousComparison,
    }, today, auth), auth.requestPerformance),
    isolated("progress.body", () => Promise.all([
      getMyProfile(auth),
      listWeightHistory(1000, auth),
      listBodyMeasurements(1000, auth),
    ]).then(([profile, weightHistory, measurements]) => buildBodyProgressReport({
      weightHistory,
      currentWeightKg: profile?.current_weight_kg ?? null,
      measurements,
      period: period.current,
      referencePeriod: period.previous,
    })), auth.requestPerformance),
    isolated(
      "progress.relationships",
      () => getHighlightedRelationshipsForUser(relationshipPeriod, today, auth),
      auth.requestPerformance,
    ),
  ]);

  return {
    period,
    model: buildProgressHomeModel({
      period,
      training: training?.general ?? null,
      nutrition: nutrition?.progressComparison
        ? { summary: nutrition.summary, comparison: nutrition.progressComparison }
        : null,
      body,
      activity: activity?.defaultComparison
        ? { definitions: activity.definitions, comparison: activity.defaultComparison }
        : null,
      relationships: relationships ?? [],
    }),
  };
}
