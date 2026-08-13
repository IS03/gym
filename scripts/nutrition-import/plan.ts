import { createHash } from "node:crypto";
import { isScheduledWorkday, periodForDate } from "./normalize.ts";
import type {
  DayPlan,
  DryRunPlan,
  ExistingDay,
  NormalizedActivityDay,
  NormalizedWorkbook,
  ProductionSnapshot,
} from "./types.ts";
import { reconcileDaily } from "./validate.ts";

const NUMERIC_TOLERANCE = 0.011;

function completedWorkouts(production: ProductionSnapshot, logDate: string): number {
  return production.workout_by_date
    .filter((row) => row.log_date === logDate && row.status === "completed")
    .reduce((sum, row) => sum + row.count, 0);
}

function periodExpectedTarget(day: NormalizedActivityDay, normalized: NormalizedWorkbook) {
  const goal = periodForDate(normalized.goalPeriods, day.logDate);
  return day.gym ? goal.caloriesGym : goal.caloriesNoGym;
}

function expectedRuleExpenditure(day: NormalizedActivityDay, normalized: NormalizedWorkbook) {
  const rule = periodForDate(normalized.expenditurePeriods, day.logDate);
  if (day.work && day.gym) return rule.workGymKcal;
  if (day.work) return rule.workNoGymKcal;
  if (day.gym) return rule.noWorkGymKcal;
  return rule.noWorkNoGymKcal;
}

function desiredDayFields(
  day: NormalizedActivityDay,
  normalized: NormalizedWorkbook,
  completedCount: number,
): Record<string, unknown> {
  const scheduledWork = isScheduledWorkday(day.logDate);
  const fields: Record<string, unknown> = {
    steps: day.steps,
    water_l: day.waterL,
    mate_l: day.mateL,
    work_effective_snapshot: day.work,
    gym_effective_snapshot: day.gym,
    work_source_snapshot: day.work === scheduledWork ? "schedule" : "override",
    gym_source_snapshot: completedCount > 0 ? "workout" : day.gym ? "override" : "none",
    nutrition_target_kcal_snapshot: day.nutritionTargetKcal,
    protein_target_g_snapshot: day.proteinTargetG,
    water_target_l_snapshot: day.waterTargetL,
    estimated_expenditure_kcal_snapshot: day.usedExpenditureKcal,
  };
  if (day.notes !== null) fields.notes = day.notes;
  if (day.weightKg !== null) fields.weight_kg = day.weightKg;
  if (day.work !== scheduledWork) {
    fields.work_override = day.work;
    fields.work_override_source = "sheet_import";
    fields.work_override_reason = "Hecho diario explícito del histórico";
  }
  if (day.gym && completedCount === 0) {
    fields.gym_override = true;
    fields.gym_override_source = "sheet_import";
    fields.gym_override_reason = "Gym histórico sin sesión completed en OWNLEVEL";
  }
  if (day.usedExpenditureKcal !== day.ruleExpenditureKcal) {
    fields.expenditure_override_kcal = day.usedExpenditureKcal;
  }
  return fields;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= NUMERIC_TOLERANCE;
  }
  return left === right;
}

function compareExisting(existing: ExistingDay, fields: Record<string, unknown>) {
  const fieldsToSet: Record<string, unknown> = {};
  const preservedExistingFields: string[] = [];
  const conflicts: string[] = [];
  const row = existing as unknown as Record<string, unknown>;
  for (const [field, desired] of Object.entries(fields)) {
    const current = row[field];
    if (current === null || current === undefined) fieldsToSet[field] = desired;
    else if (sameValue(current, desired)) preservedExistingFields.push(field);
    else conflicts.push(`${field}: producción=${JSON.stringify(current)}, sheet=${JSON.stringify(desired)}`);
  }
  return { fieldsToSet, preservedExistingFields, conflicts };
}

function buildDayPlan(
  day: NormalizedActivityDay,
  normalized: NormalizedWorkbook,
  production: ProductionSnapshot,
): DayPlan {
  const completedCount = completedWorkouts(production, day.logDate);
  const existing = production.day_logs.find((row) => row.log_date === day.logDate);
  const fields = desiredDayFields(day, normalized, completedCount);
  const goal = periodForDate(normalized.goalPeriods, day.logDate);
  const expenditure = periodForDate(normalized.expenditurePeriods, day.logDate);
  const schedule = periodForDate(normalized.workSchedulePeriods, day.logDate);
  if (!existing) {
    return {
      logDate: day.logDate,
      classification: "INSERT",
      fieldsToSet: fields,
      preservedExistingFields: [],
      conflicts: [],
      nutritionGoalRef: goal.ref,
      expenditureRuleRef: expenditure.ref,
      workScheduleRef: schedule.ref,
    };
  }
  const noteConflict = existing.notes_present === true && fields.notes !== undefined;
  if (noteConflict) delete fields.notes;
  const comparison = compareExisting(existing, fields);
  if (noteConflict) comparison.conflicts.push("notes: producción ya contiene texto; no se sobrescribe ni concatena automáticamente");
  return {
    logDate: day.logDate,
    classification: comparison.conflicts.length > 0
      ? "CONFLICT"
      : Object.keys(comparison.fieldsToSet).length > 0 ? "MERGE_SAFE" : "NO_OP",
    ...comparison,
    nutritionGoalRef: goal.ref,
    expenditureRuleRef: expenditure.ref,
    workScheduleRef: schedule.ref,
  };
}

export function mealFingerprint(meal: NormalizedWorkbook["meals"][number]): string {
  return createHash("sha256").update(JSON.stringify({
    legacyImportSource: meal.legacyImportSource,
    legacyImportId: meal.legacyImportId,
    sourceType: meal.sourceType,
    logDate: meal.logDate,
    consumedAt: meal.consumedAt,
    entryKind: meal.entryKind,
    mealLabel: meal.mealLabel,
    contextType: meal.contextType,
    title: meal.title,
    calories: meal.finalCalories,
    protein: meal.finalProteinG,
    carbs: meal.finalCarbsG,
    fat: meal.finalFatG,
    precisionLevel: meal.precisionLevel,
    sourceNote: meal.sourceNote,
    rawInput: meal.rawInput,
    active: meal.active,
  })).digest("hex");
}

export function buildDryRunPlan(
  normalized: NormalizedWorkbook,
  production: ProductionSnapshot,
): DryRunPlan {
  const anomalies = [...normalized.anomalies];
  const duplicateIds = Map.groupBy(normalized.meals, (meal) => meal.legacyImportId);
  for (const [id, rows] of duplicateIds) {
    if (rows.length > 1) anomalies.push({
      code: "DUPLICATE_LEGACY_MEAL_ID",
      severity: "blocker",
      sheet: "Registro de comidas",
      message: `El legacy ID ${id} aparece ${rows.length} veces.`,
    });
  }

  const dayComposition = Map.groupBy(normalized.meals.filter((meal) => meal.active), (meal) => meal.logDate);
  for (const [logDate, meals] of dayComposition) {
    if (meals.some((meal) => meal.entryKind === "legacy_daily_summary") && meals.some((meal) => meal.entryKind === "meal")) {
      anomalies.push({
        code: "LEGACY_SUMMARY_DETAIL_COEXISTENCE",
        severity: "blocker",
        sheet: "Registro de comidas",
        logDate,
        message: "Un resumen heredado activo coexistiría con comidas detalladas activas.",
      });
    }
  }

  for (const day of normalized.activityDays) {
    if (day.nutritionTargetKcal !== periodExpectedTarget(day, normalized)) anomalies.push({
      code: "TARGET_PERIOD_MISMATCH", severity: "blocker", sheet: "Actividad diaria", sourceRow: day.sourceRow,
      logDate: day.logDate, message: "Meta kcal del día no coincide con el período y el hecho de gym.",
    });
    if (day.ruleExpenditureKcal !== expectedRuleExpenditure(day, normalized)) anomalies.push({
      code: "EXPENDITURE_RULE_MISMATCH", severity: "blocker", sheet: "Actividad diaria", sourceRow: day.sourceRow,
      logDate: day.logDate, message: "Gasto regla del día no coincide con la matriz histórica.",
    });
  }

  const workoutConflicts: string[] = [];
  for (const day of normalized.activityDays) {
    const count = completedWorkouts(production, day.logDate);
    if (!day.gym && count > 0) workoutConflicts.push(`${day.logDate}: Sheet Gym=No y producción tiene ${count} sesión(es) completed`);
  }

  const weightConflicts: string[] = [];
  for (const weight of normalized.weights.filter((item) => item.logDate !== null)) {
    const existing = production.day_logs.find((day) => day.log_date === weight.logDate);
    if (existing?.weight_kg !== null && existing?.weight_kg !== undefined && Math.abs(existing.weight_kg - weight.weightKg) > NUMERIC_TOLERANCE) {
      weightConflicts.push(`${weight.logDate}: producción=${existing.weight_kg}, sheet=${weight.weightKg}`);
    }
  }

  const existingKeys = new Map(production.legacy_keys.map((key) => [`${key.legacy_import_source}:${key.legacy_import_id}`, key]));
  let inserts = 0;
  let noOps = 0;
  const mealConflicts: string[] = [];
  for (const meal of normalized.meals) {
    const key = `${meal.legacyImportSource}:${meal.legacyImportId}`;
    const existing = existingKeys.get(key);
    if (!existing) inserts += 1;
    else if (existing.fingerprint === mealFingerprint(meal)) noOps += 1;
    else mealConflicts.push(`${meal.legacyImportId}: mismo legacy ID sin fingerprint verificable o con contenido diferente`);
  }

  const reconciliation = reconcileDaily({
    meals: normalized.meals,
    activityDays: normalized.activityDays,
    oracle: normalized.dailyOracle,
  });
  const schemaGaps: string[] = [];
  if (normalized.bodyMeasurements.some((row) => Object.keys(row.unrepresentable).length > 0)) {
    schemaGaps.push("body_measurements no representa abdomen, laterales separados, pantorrillas, condición, fotos ni notas.");
  }
  if (normalized.foods.some((food) => !food.schemaCompatible)) {
    schemaGaps.push("foods exige los tres macros, pero la fuente contiene al menos un alimento con macros desconocidos.");
  }
  if (normalized.events.length > 0) {
    schemaGaps.push("Permitidos necesita un destino estructurado (por ejemplo nutrition_events); comidas/notas no preservan todos sus campos.");
  }

  const dayLogs = normalized.activityDays.map((day) => buildDayPlan(day, normalized, production));
  const blockers = [
    ...anomalies.filter((item) => item.severity === "blocker").map((item) => `${item.code}: ${item.message}`),
    ...workoutConflicts.map((item) => `WORKOUT_CONFLICT: ${item}`),
    ...weightConflicts.map((item) => `WEIGHT_CONFLICT: ${item}`),
    ...mealConflicts.map((item) => `MEAL_CONFLICT: ${item}`),
    ...dayLogs.filter((day) => day.classification === "CONFLICT").map((day) => `DAY_LOG_CONFLICT ${day.logDate}: ${day.conflicts.join("; ")}`),
    ...schemaGaps.map((gap) => `SCHEMA_GAP: ${gap}`),
    ...(reconciliation.mismatchDays > 0 ? [`DAILY_RECONCILIATION: ${reconciliation.mismatchDays} día(s) con diferencias significativas`] : []),
  ];

  return {
    sourceName: normalized.sourceName,
    spreadsheetId: normalized.spreadsheetId,
    sourceSha256: normalized.sourceSha256,
    sourceRange: normalized.sourceRange,
    rowCounts: normalized.rowCounts,
    dayLogs,
    meals: {
      detailed: normalized.meals.filter((meal) => meal.entryKind === "meal").length,
      legacySummaries: normalized.meals.filter((meal) => meal.entryKind === "legacy_daily_summary").length,
      active: normalized.meals.filter((meal) => meal.active).length,
      inactive: normalized.meals.filter((meal) => !meal.active).length,
      inserts,
      noOps,
      conflicts: mealConflicts,
      rows: normalized.meals,
    },
    goalPeriods: normalized.goalPeriods,
    expenditurePeriods: normalized.expenditurePeriods,
    workSchedulePeriods: normalized.workSchedulePeriods,
    foods: normalized.foods,
    weights: { detected: normalized.weights, conflicts: weightConflicts },
    bodyMeasurements: normalized.bodyMeasurements,
    events: normalized.events,
    workoutConflicts,
    reconciliation,
    schemaGaps,
    anomalies,
    blockers,
    applyReady: blockers.length === 0,
  };
}
