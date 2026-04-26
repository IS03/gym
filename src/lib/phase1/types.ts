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
  created_at: string;
  updated_at: string;
};

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
  source_type: "manual" | "label" | "ai" | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

