export type DayLog = {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  weight_kg: number | null;
  notes: string | null;
  bmr_kcal_snapshot: number | null;
  maintenance_kcal_snapshot: number | null;
  target_kcal_snapshot: number | null;
  goal_type_snapshot: string | null;
  total_calories_consumed: number;
  total_protein_g: number;
  delta_vs_target: number | null;
  delta_vs_maintenance: number | null;
  work_override: boolean | null;
  work_override_source: string | null;
  work_override_reason: string | null;
  gym_override: true | null;
  gym_override_source: string | null;
  gym_override_reason: string | null;
  steps: number | null;
  water_l: number | null;
  mate_l: number | null;
  expenditure_override_kcal: number | null;
  work_effective_snapshot: boolean | null;
  gym_effective_snapshot: boolean | null;
  work_source_snapshot: string | null;
  gym_source_snapshot: string | null;
  nutrition_goal_period_id: string | null;
  expenditure_rule_period_id: string | null;
  work_schedule_period_id: string | null;
  nutrition_target_kcal_snapshot: number | null;
  protein_target_g_snapshot: number | null;
  water_target_l_snapshot: number | null;
  estimated_expenditure_kcal_snapshot: number | null;
  total_carbs_g: number;
  total_fat_g: number;
  delta_vs_nutrition_target: number | null;
  energy_balance_kcal: number | null;
  nutrition_resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MealEntryKind = "meal" | "legacy_daily_summary";
export type NutritionPrecision =
  | "catalog"
  | "label"
  | "estimated"
  | "historical";

export type MealEntry = {
  id: string;
  user_id: string;
  day_log_id: string;
  consumed_at: string;
  meal_label: "breakfast" | "lunch" | "snack" | "dinner" | "extra" | null;
  title: string | null;
  description: string | null;
  final_calories: number | null;
  final_protein_g: number | null;
  final_carbs_g: number | null;
  final_fat_g: number | null;
  entry_kind: MealEntryKind;
  precision_level: NutritionPrecision | null;
  context_type: string | null;
  source_note: string | null;
  raw_input: string | null;
  legacy_import_source: string | null;
  legacy_import_id: string | null;
  idempotency_key: string | null;
  import_run_id: string | null;
  source_type:
    | "manual"
    | "label"
    | "ai"
    | "chatgpt"
    | "sheet_import"
    | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NutritionGoalPeriod = {
  id: string;
  user_id: string;
  effective_from: string;
  name: string;
  calories_no_gym: number;
  calories_gym: number;
  protein_no_gym_g: number;
  protein_gym_g: number;
  water_no_gym_l: number;
  water_gym_l: number;
  goal_type: "lose" | "maintain" | "gain" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenditureRulePeriod = {
  id: string;
  user_id: string;
  effective_from: string;
  name: string;
  work_gym_kcal: number;
  work_no_gym_kcal: number;
  no_work_gym_kcal: number;
  no_work_no_gym_kcal: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkSchedulePeriod = {
  id: string;
  user_id: string;
  effective_from: string;
  name: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  created_at: string;
  updated_at: string;
};

export type NutritionImportRun = {
  id: string;
  user_id: string;
  source_name: string;
  source_sha256: string;
  applied_at: string;
  counts: Record<string, unknown>;
  report: Record<string, unknown>;
};

export type Food = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  serving_quantity: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  precision_level: NutritionPrecision | null;
  source_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
