export type CellValue = string | number | boolean | null;

export type WorkbookSnapshot = {
  spreadsheetId: string;
  sourceName: string;
  locale: string;
  timezone: string;
  sheets: Record<string, CellValue[][]>;
};

export type NutritionPrecision = "catalog" | "label" | "estimated" | "historical";
export type MealLabel = "breakfast" | "lunch" | "snack" | "dinner" | "extra" | null;

export type NormalizedMeal = {
  sourceRow: number;
  sourceType: "sheet_import";
  legacyImportSource: "google-sheet:registro-comidas:v1";
  legacyImportId: string;
  logDate: string;
  consumedAt: string;
  originalTimeKnown: boolean;
  originalTime: string | null;
  mealLabel: MealLabel;
  entryKind: "meal" | "legacy_daily_summary";
  contextType: string | null;
  title: string;
  finalCalories: number;
  finalProteinG: number | null;
  finalCarbsG: number | null;
  finalFatG: number | null;
  precisionLevel: NutritionPrecision;
  originalPrecision: string | null;
  sourceNote: string | null;
  rawInput: Record<string, unknown>;
  active: boolean;
  deletedAtPolicy: "none" | "import_applied_at";
};

export type NormalizedActivityDay = {
  sourceRow: number;
  logDate: string;
  status: string;
  work: boolean;
  gym: boolean;
  steps: number | null;
  weightKg: number | null;
  waterL: number | null;
  mateL: number | null;
  sourceExpenditureOverrideKcal: number | null;
  notes: string | null;
  nutritionTargetKcal: number;
  proteinTargetG: number;
  ruleExpenditureKcal: number;
  usedExpenditureKcal: number;
  waterTargetL: number;
};

export type GoalPeriodPlan = {
  ref: string;
  effectiveFrom: string;
  name: string;
  caloriesNoGym: number;
  caloriesGym: number;
  proteinNoGymG: number;
  proteinGymG: number;
  waterNoGymL: number;
  waterGymL: number;
  sharedProteinSource: true;
};

export type ExpenditurePeriodPlan = {
  ref: string;
  effectiveFrom: string;
  name: string;
  workGymKcal: number;
  workNoGymKcal: number;
  noWorkGymKcal: number;
  noWorkNoGymKcal: number;
};

export type WorkSchedulePlan = {
  ref: string;
  effectiveFrom: string;
  name: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

export type NormalizedFood = {
  sourceRow: number;
  name: string;
  servingQuantity: number;
  servingUnit: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sourceNote: string | null;
  precisionLevel: NutritionPrecision;
  active: boolean;
  hasKnownNutrition: boolean;
};

export type WeightFact = {
  logDate: string | null;
  weightKg: number;
  sources: Array<"activity" | "body_measurements">;
  sourceRows: number[];
  disposition: "IMPORT" | "SKIP_UNDATED";
  sourcePayloads: Array<Record<string, unknown>>;
};

export type NormalizedBodyMeasurement = {
  sourceRow: number;
  legacyImportSource: "google-sheet:medidas-progreso:v1";
  legacyImportId: string | null;
  measuredOn: string | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armRightCm: number | null;
  armLeftCm: number | null;
  thighRightCm: number | null;
  thighLeftCm: number | null;
  calfRightCm: number | null;
  calfLeftCm: number | null;
  condition: string | null;
  notes: string | null;
  qualityStatus: "verified" | "suspect";
  qualityNote: string | null;
  sourcePayload: Record<string, unknown>;
  disposition: "IMPORT" | "SKIP_UNDATED";
};

export type NormalizedNutritionEvent = {
  sourceRow: number;
  sourceType: "sheet_import";
  legacyImportSource: "google-sheet:permitidos:v1";
  legacyImportId: string;
  eventDate: string;
  eventType: string;
  intensity: string | null;
  planned: boolean | null;
  alcohol: boolean | null;
  drinksEquivalent: number | null;
  eventCalories: number | null;
  context: string | null;
  notes: string | null;
  origin: string | null;
};

export type DailyOracle = {
  sourceRow: number;
  logDate: string;
  calories: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  waterL: number | null;
  mateL: number | null;
  work: boolean;
  gym: boolean;
  steps: number | null;
  weightKg: number | null;
  targetKcal: number;
  expenditureKcal: number;
  energyBalanceKcal: number;
};

export type ImportAnomaly = {
  code: string;
  severity: "warning" | "blocker";
  sheet: string;
  sourceRow?: number;
  logDate?: string | null;
  message: string;
  sourcePayload?: Record<string, unknown>;
};

export type NormalizedWorkbook = {
  spreadsheetId: string;
  sourceName: string;
  sourceSha256: string;
  sourceRange: { from: string; to: string };
  rowCounts: Record<string, number>;
  meals: NormalizedMeal[];
  activityDays: NormalizedActivityDay[];
  goalPeriods: GoalPeriodPlan[];
  expenditurePeriods: ExpenditurePeriodPlan[];
  workSchedulePeriods: WorkSchedulePlan[];
  foods: NormalizedFood[];
  weights: WeightFact[];
  bodyMeasurements: NormalizedBodyMeasurement[];
  nutritionEvents: NormalizedNutritionEvent[];
  dailyOracle: DailyOracle[];
  anomalies: ImportAnomaly[];
};

export type ExistingDay = {
  log_date: string;
  weight_kg: number | null;
  work_override: boolean | null;
  gym_override: boolean | null;
  steps: number | null;
  water_l: number | null;
  mate_l: number | null;
  expenditure_override_kcal: number | null;
  work_effective_snapshot: boolean | null;
  gym_effective_snapshot: boolean | null;
  nutrition_target_kcal_snapshot: number | null;
  protein_target_g_snapshot: number | null;
  water_target_l_snapshot: number | null;
  estimated_expenditure_kcal_snapshot: number | null;
  total_calories_consumed: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  notes_present?: boolean;
};

export type ProductionSnapshot = {
  profile: { current_weight_kg: number | null; bmr_kcal_current: number | null } | null;
  day_logs: ExistingDay[];
  workout_by_date: Array<{ log_date: string; status: string; count: number }>;
  body_measurements: Array<{
    measured_on: string;
    legacy_import_source: string | null;
    legacy_import_id: string | null;
    fingerprint?: string;
  }>;
  nutrition_event_keys?: Array<{
    legacy_import_source: string;
    legacy_import_id: string;
    fingerprint?: string;
  }>;
  meal_entries_count: number;
  legacy_keys: Array<{
    legacy_import_source: string;
    legacy_import_id: string;
    deleted: boolean;
    fingerprint?: string;
  }>;
  config_counts: Record<string, number>;
  regression_counts: Record<string, number>;
};

export type DayPlan = {
  logDate: string;
  classification: "INSERT" | "MERGE_SAFE" | "NO_OP" | "CONFLICT";
  fieldsToSet: Record<string, unknown>;
  preservedExistingFields: string[];
  conflicts: string[];
  nutritionGoalRef: string;
  expenditureRuleRef: string;
  workScheduleRef: string;
};

export type ReconciliationResult = {
  exactDays: number;
  withinToleranceDays: number;
  sourceWinsDays: number;
  mismatchDays: number;
  mismatches: Array<{ logDate: string; fields: string[] }>;
  warnings: Array<{
    code: "SOURCE_WINS";
    logDate: string;
    fields: string[];
    message: string;
  }>;
  tolerances: { caloriesKcal: number; macrosG: number; liquidsL: number };
};

export type DryRunPlan = {
  sourceName: string;
  spreadsheetId: string;
  sourceSha256: string;
  sourceRange: { from: string; to: string };
  rowCounts: Record<string, number>;
  dayLogs: DayPlan[];
  meals: {
    detailed: number;
    legacySummaries: number;
    active: number;
    inactive: number;
    inserts: number;
    noOps: number;
    conflicts: string[];
    rows: NormalizedMeal[];
  };
  goalPeriods: GoalPeriodPlan[];
  expenditurePeriods: ExpenditurePeriodPlan[];
  workSchedulePeriods: WorkSchedulePlan[];
  foods: NormalizedFood[];
  weights: {
    detected: WeightFact[];
    conflicts: string[];
  };
  bodyMeasurements: {
    inserts: number;
    noOps: number;
    skippedUndated: number;
    conflicts: string[];
    rows: NormalizedBodyMeasurement[];
  };
  nutritionEvents: {
    inserts: number;
    noOps: number;
    conflicts: string[];
    rows: NormalizedNutritionEvent[];
  };
  workoutConflicts: string[];
  reconciliation: ReconciliationResult;
  schemaGaps: string[];
  anomalies: ImportAnomaly[];
  importReport: {
    anomalies: ImportAnomaly[];
    skippedUndatedFacts: WeightFact[];
    suspectMeasurements: NormalizedBodyMeasurement[];
    sourceWinsWarnings: ReconciliationResult["warnings"];
    reconciliation: ReconciliationResult;
    counts: Record<string, number>;
    decisions: string[];
  };
  blockers: string[];
  applyReady: boolean;
};
