import { createClient } from "@/lib/supabase/server";

export type Sex = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export type Profile = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null; // YYYY-MM-DD
  sex: Sex | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal_type: GoalType | null;
  bmr_kcal_current: number | null;
  maintenance_kcal_current: number | null;
  target_kcal_current: number | null;
  created_at: string;
  updated_at: string;
};

function calcAge(birthDate: string): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mm = today.getMonth() + 1;
  const dd = today.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}

export function calculateBmrKcal(params: {
  sex: Sex;
  birth_date: string;
  height_cm: number;
  weight_kg: number;
}): number {
  const age = calcAge(params.birth_date);
  // Mifflin-St Jeor
  const base = 10 * params.weight_kg + 6.25 * params.height_cm - 5 * age;
  const sexAdj = params.sex === "male" ? 5 : params.sex === "female" ? -161 : -78;
  return Math.round(base + sexAdj);
}

export function activityMultiplier(level: ActivityLevel): number {
  switch (level) {
    case "sedentary":
      return 1.2;
    case "light":
      return 1.375;
    case "moderate":
      return 1.55;
    case "active":
      return 1.725;
    case "very_active":
      return 1.9;
  }
}

export function goalDeltaKcal(goal: GoalType): number {
  // Simple y explícito para Fase 1 (ajustable luego):
  // - lose: -300 kcal
  // - maintain: 0
  // - gain: +300 kcal
  switch (goal) {
    case "lose":
      return -300;
    case "maintain":
      return 0;
    case "gain":
      return 300;
  }
}

export async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Auth falló: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return user;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getAuthedUser();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Leer profiles: ${error.message}`);
  return (data ?? null) as Profile | null;
}

export async function upsertMyProfile(input: {
  display_name: string | null;
  birth_date: string | null;
  sex: Sex | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal_type: GoalType | null;
}): Promise<Profile> {
  const supabase = await createClient();
  const user = await getAuthedUser();

  let bmr: number | null = null;
  let maintenance: number | null = null;
  let target: number | null = null;

  if (
    input.sex &&
    input.birth_date &&
    typeof input.height_cm === "number" &&
    typeof input.current_weight_kg === "number"
  ) {
    bmr = calculateBmrKcal({
      sex: input.sex,
      birth_date: input.birth_date,
      height_cm: input.height_cm,
      weight_kg: input.current_weight_kg,
    });

    if (input.activity_level) {
      maintenance = Math.round(bmr * activityMultiplier(input.activity_level));
      if (input.goal_type) {
        target = maintenance + goalDeltaKcal(input.goal_type);
      } else {
        target = maintenance;
      }
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: input.display_name,
        birth_date: input.birth_date,
        sex: input.sex,
        height_cm: input.height_cm,
        current_weight_kg: input.current_weight_kg,
        activity_level: input.activity_level,
        goal_type: input.goal_type,
        bmr_kcal_current: bmr,
        maintenance_kcal_current: maintenance,
        target_kcal_current: target,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Guardar profiles: ${error.message}`);
  return data as Profile;
}

