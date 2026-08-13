import { createClient } from "@/lib/supabase/server";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export type Sex = "male" | "female" | "other";

export type Profile = {
  user_id: string;
  display_name: string | null;
  birth_date: string | null; // YYYY-MM-DD
  sex: Sex | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  bmr_kcal_current: number | null;
  maintenance_kcal_current: number | null;
  target_kcal_current: number | null;
  goal_type: string | null;
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
  // Harris–Benedict (según lo pedido):
  // Hombres: TMB = 88.362 + 13.397*peso + 4.799*altura - 5.677*edad
  // Mujeres: TMB = 447.593 + 9.247*peso + 3.098*altura - 4.330*edad
  if (params.sex === "female") {
    return Math.round(
      447.593 +
        9.247 * params.weight_kg +
        3.098 * params.height_cm -
        4.33 * age,
    );
  }

  // Para "male" y "other" usamos la fórmula de hombres (regla simple por ahora).
  return Math.round(
    88.362 +
      13.397 * params.weight_kg +
      4.799 * params.height_cm -
      5.677 * age,
  );
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
  const user = await getAuthedUser();
  return getProfileForUser(user.id);
}

export async function getProfileForUser(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
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
    // En esta etapa: "mantenimiento" = TMB (Harris–Benedict) sin multiplicadores.
    // Más adelante, si volvemos a agregar actividad/objetivo, se deriva acá.
    maintenance = bmr;
    target = bmr;
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

/** Actualiza el peso actual y los cálculos derivados sin tocar snapshots diarios. */
export async function updateMyCurrentWeightKg(
  currentWeightKg: number | null,
): Promise<Profile> {
  const current = await getMyProfile();
  const profile = await upsertMyProfile({
    display_name: current?.display_name ?? null,
    birth_date: current?.birth_date ?? null,
    sex: current?.sex ?? null,
    height_cm: current?.height_cm ?? null,
    current_weight_kg: currentWeightKg,
  });
  try {
    await syncTodayNutritionSnapshots(profile);
  } catch {
    // El perfil y el historial ya son válidos; un snapshot es sólo la vista del día actual.
  }
  return profile;
}

/** Actualiza sólo el snapshot del día actual; los días históricos quedan inmutables. */
export async function syncTodayNutritionSnapshots(profile: Profile): Promise<void> {
  const supabase = await createClient();
  const { data: dayLog, error } = await supabase
    .from("day_logs")
    .select("id, total_calories_consumed")
    .eq("user_id", profile.user_id)
    .eq("log_date", todayInCordoba())
    .maybeSingle();
  if (error) throw new Error(`Leer snapshot actual: ${error.message}`);
  if (!dayLog) return;

  const target = profile.target_kcal_current;
  const maintenance = profile.maintenance_kcal_current;
  const total = dayLog.total_calories_consumed ?? 0;
  const { error: updateError } = await supabase
    .from("day_logs")
    .update({
      bmr_kcal_snapshot: profile.bmr_kcal_current,
      maintenance_kcal_snapshot: maintenance,
      target_kcal_snapshot: target,
      goal_type_snapshot: profile.goal_type,
      delta_vs_target: target === null ? null : total - target,
      delta_vs_maintenance: maintenance === null ? null : total - maintenance,
    })
    .eq("id", dayLog.id)
    .eq("user_id", profile.user_id);
  if (updateError) throw new Error(`Actualizar snapshot actual: ${updateError.message}`);
}
