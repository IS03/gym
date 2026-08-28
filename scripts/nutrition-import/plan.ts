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
    if (sameValue(current, desired)) preservedExistingFields.push(field);
    else if (current === null || current === undefined) fieldsToSet[field] = desired;
    else conflicts.push(`${field}: producción=${JSON.stringify(current)}, sheet=${JSON.stringify(desired)}`);
  }
  return { fieldsToSet, preservedExistingFields, conflicts };
}

function buildDayPlan(
  day: NormalizedActivityDay,
  normalized: NormalizedWorkbook,
  production: ProductionSnapshot,
  sourceAlreadyApplied: boolean,
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
      expectedFields: fields,
      nutritionGoalRef: goal.ref,
      expenditureRuleRef: expenditure.ref,
      workScheduleRef: schedule.ref,
    };
  }
  const noteConflict = !sourceAlreadyApplied && existing.notes_present === true && fields.notes !== undefined;
  if (sourceAlreadyApplied && existing.notes_present === true) delete fields.notes;
  if (noteConflict) delete fields.notes;
  const comparison = compareExisting(existing, fields);
  if (noteConflict) comparison.conflicts.push("notes: producción ya contiene texto; no se sobrescribe ni concatena automáticamente");
  return {
    logDate: day.logDate,
    classification: comparison.conflicts.length > 0
      ? "CONFLICT"
      : Object.keys(comparison.fieldsToSet).length > 0 ? "MERGE_SAFE" : "NO_OP",
    ...comparison,
    expectedFields: fields,
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

export function bodyMeasurementFingerprint(
  measurement: NormalizedWorkbook["bodyMeasurements"][number],
): string {
  return createHash("sha256").update(JSON.stringify({
    legacyImportSource: measurement.legacyImportSource,
    legacyImportId: measurement.legacyImportId,
    measuredOn: measurement.measuredOn,
    waistCm: measurement.waistCm,
    abdomenCm: measurement.abdomenCm,
    hipCm: measurement.hipCm,
    chestCm: measurement.chestCm,
    armRightCm: measurement.armRightCm,
    armLeftCm: measurement.armLeftCm,
    thighRightCm: measurement.thighRightCm,
    thighLeftCm: measurement.thighLeftCm,
    calfRightCm: measurement.calfRightCm,
    calfLeftCm: measurement.calfLeftCm,
    condition: measurement.condition,
    notes: measurement.notes,
    qualityStatus: measurement.qualityStatus,
    qualityNote: measurement.qualityNote,
    sourcePayload: measurement.sourcePayload,
  })).digest("hex");
}

export function nutritionEventFingerprint(
  event: NormalizedWorkbook["nutritionEvents"][number],
): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
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

  const duplicateBodyIds = Map.groupBy(
    normalized.bodyMeasurements.filter((measurement) => measurement.legacyImportId !== null),
    (measurement) => measurement.legacyImportId,
  );
  for (const [id, rows] of duplicateBodyIds) {
    if (rows.length > 1) anomalies.push({
      code: "DUPLICATE_LEGACY_BODY_ID",
      severity: "blocker",
      sheet: "Medidas y progreso",
      message: `El legacy ID ${id} aparece ${rows.length} veces.`,
    });
  }

  const duplicateEventIds = Map.groupBy(normalized.nutritionEvents, (event) => event.legacyImportId);
  for (const [id, rows] of duplicateEventIds) {
    if (rows.length > 1) anomalies.push({
      code: "DUPLICATE_LEGACY_EVENT_ID",
      severity: "blocker",
      sheet: "Permitidos",
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

  let bodyInserts = 0;
  let bodyNoOps = 0;
  const bodyConflicts: string[] = [];
  const existingBodyKeys = new Map(production.body_measurements
    .filter((row) => row.legacy_import_source && row.legacy_import_id)
    .map((row) => [`${row.legacy_import_source}:${row.legacy_import_id}`, row]));
  for (const measurement of normalized.bodyMeasurements.filter((row) => row.disposition === "IMPORT")) {
    const key = `${measurement.legacyImportSource}:${measurement.legacyImportId}`;
    const existingByKey = existingBodyKeys.get(key);
    const existingByDate = production.body_measurements.find((row) => row.measured_on === measurement.measuredOn);
    if (existingByKey?.fingerprint === bodyMeasurementFingerprint(measurement)) bodyNoOps += 1;
    else if (existingByKey) bodyConflicts.push(`${measurement.legacyImportId}: mismo legacy ID con contenido diferente`);
    else if (existingByDate) bodyConflicts.push(`${measurement.measuredOn}: ya existe una medición sin el mismo legacy ID`);
    else bodyInserts += 1;
  }

  let eventInserts = 0;
  let eventNoOps = 0;
  const eventConflicts: string[] = [];
  const eventKeys = new Map((production.nutrition_event_keys ?? [])
    .map((row) => [`${row.legacy_import_source}:${row.legacy_import_id}`, row]));
  for (const event of normalized.nutritionEvents) {
    const key = `${event.legacyImportSource}:${event.legacyImportId}`;
    const existing = eventKeys.get(key);
    if (!existing) eventInserts += 1;
    else if (existing.fingerprint === nutritionEventFingerprint(event)) eventNoOps += 1;
    else eventConflicts.push(`${event.legacyImportId}: mismo legacy ID sin fingerprint verificable o con contenido diferente`);
  }

  const sourceAlreadyApplied = production.applied_imports?.some(
    (run) => run.source_name === normalized.sourceName && run.source_sha256 === normalized.sourceSha256,
  ) ?? false;
  const dayLogs = normalized.activityDays.map((day) => buildDayPlan(day, normalized, production, sourceAlreadyApplied));
  const blockers = [
    ...anomalies.filter((item) => item.severity === "blocker").map((item) => `${item.code}: ${item.message}`),
    ...workoutConflicts.map((item) => `WORKOUT_CONFLICT: ${item}`),
    ...weightConflicts.map((item) => `WEIGHT_CONFLICT: ${item}`),
    ...mealConflicts.map((item) => `MEAL_CONFLICT: ${item}`),
    ...bodyConflicts.map((item) => `BODY_MEASUREMENT_CONFLICT: ${item}`),
    ...eventConflicts.map((item) => `NUTRITION_EVENT_CONFLICT: ${item}`),
    ...dayLogs.filter((day) => day.classification === "CONFLICT").map((day) => `DAY_LOG_CONFLICT ${day.logDate}: ${day.conflicts.join("; ")}`),
    ...schemaGaps.map((gap) => `SCHEMA_GAP: ${gap}`),
    ...(reconciliation.mismatchDays > 0 ? [`DAILY_RECONCILIATION: ${reconciliation.mismatchDays} día(s) con diferencias significativas`] : []),
  ];

  const importReport = {
    anomalies,
    skippedUndatedFacts: normalized.weights.filter((weight) => weight.disposition === "SKIP_UNDATED"),
    suspectMeasurements: normalized.bodyMeasurements.filter(
      (measurement) => measurement.disposition === "IMPORT" && measurement.qualityStatus === "suspect",
    ),
    sourceWinsWarnings: reconciliation.warnings,
    reconciliation,
    counts: {
      dayLogs: normalized.activityDays.length,
      meals: normalized.meals.length,
      foods: normalized.foods.length,
      weights: normalized.weights.length,
      bodyMeasurements: normalized.bodyMeasurements.filter((row) => row.disposition === "IMPORT").length,
      nutritionEvents: normalized.nutritionEvents.length,
    },
    decisions: [
      "Los hechos sin fecha se preservan en report y no se importan.",
      "Las mediciones sospechosas se preservan sin promedios, con quality_status=suspect.",
      "Un valor nutricional primario no nulo gana ante un oráculo derivado nulo.",
      "nutrition_events no aporta calorías a meal_entries ni a los totales diarios.",
    ],
  };

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
    bodyMeasurements: {
      inserts: bodyInserts,
      noOps: bodyNoOps,
      skippedUndated: normalized.bodyMeasurements.filter((row) => row.disposition === "SKIP_UNDATED").length,
      conflicts: bodyConflicts,
      rows: normalized.bodyMeasurements,
    },
    nutritionEvents: {
      inserts: eventInserts,
      noOps: eventNoOps,
      conflicts: eventConflicts,
      rows: normalized.nutritionEvents,
    },
    workoutConflicts,
    reconciliation,
    schemaGaps,
    anomalies,
    importReport,
    blockers,
    applyReady: blockers.length === 0,
  };
}
