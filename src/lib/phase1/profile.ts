import { createClient } from "@/lib/supabase/server";

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

