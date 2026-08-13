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
  /** @deprecated Compatibilidad histórica; no es el gasto nutricional nuevo. */
  maintenance_kcal_current: number | null;
  /** @deprecated Compatibilidad histórica; no es el objetivo nutricional nuevo. */
  target_kcal_current: number | null;
  goal_type: string | null;
  created_at: string;
  updated_at: string;
};

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
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Guardar profiles: ${error.message}`);
  return data as Profile;
}
