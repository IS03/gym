"use server";

import { revalidatePath } from "next/cache";
import { upsertMyProfile } from "@/lib/phase1/profile";
import { createClient } from "@/lib/supabase/server";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function saveProfileAction(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const birthDate = String(formData.get("birth_date") ?? "").trim() || null;
  const sexRaw = String(formData.get("sex") ?? "").trim();
  const height = parseNumber(formData.get("height_cm"));
  const weight = parseNumber(formData.get("current_weight_kg"));

  const sex =
    sexRaw === "male" || sexRaw === "female" || sexRaw === "other" ? sexRaw : null;

  await upsertMyProfile({
    display_name: displayName,
    birth_date: birthDate,
    sex,
    height_cm: height,
    current_weight_kg: weight,
  });

  // Sincroniza snapshots del día actual (solo hoy) para que aparezca Target/Delta
  // aunque el day_log se haya creado antes de completar el perfil.
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: dayLog } = await supabase
      .from("day_logs")
      .select(
        "id, user_id, log_date, total_calories_consumed, target_kcal_snapshot, maintenance_kcal_snapshot",
      )
      .eq("log_date", today)
      .maybeSingle();

    if (dayLog) {
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "bmr_kcal_current, maintenance_kcal_current, target_kcal_current, goal_type",
        )
        .eq("user_id", dayLog.user_id)
        .maybeSingle();

      if (profile) {
        const target = profile.target_kcal_current;
        const maint = profile.maintenance_kcal_current;
        const total = dayLog.total_calories_consumed ?? 0;

        await supabase
          .from("day_logs")
          .update({
            bmr_kcal_snapshot: profile.bmr_kcal_current,
            maintenance_kcal_snapshot: maint,
            target_kcal_snapshot: target,
            goal_type_snapshot: profile.goal_type,
            delta_vs_target: target == null ? null : total - target,
            delta_vs_maintenance: maint == null ? null : total - maint,
          })
          .eq("id", dayLog.id);
      }
    }
  } catch {
    // Si falla, no bloqueamos el guardado del perfil.
  }

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
}

