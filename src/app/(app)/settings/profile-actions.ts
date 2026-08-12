"use server";

import { revalidatePath } from "next/cache";
import { getMyProfile, upsertMyProfile } from "@/lib/phase1/profile";
import { recordWeightForDate } from "@/lib/phase1/day-log";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { createClient } from "@/lib/supabase/server";
import {
  formatWeightKg,
  parseOptionalWeight,
  shouldRecordCurrentWeight,
} from "@/lib/weight-history";

export type ProfileSaveState = {
  status: "idle" | "success" | "partial" | "error";
  message: string | null;
};

export const initialProfileSaveState: ProfileSaveState = {
  status: "idle",
  message: null,
};

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function saveProfileAction(
  _previousState: ProfileSaveState,
  formData: FormData,
): Promise<ProfileSaveState> {
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const birthDate = String(formData.get("birth_date") ?? "").trim() || null;
  const sexRaw = String(formData.get("sex") ?? "").trim();
  const height = parseNumber(formData.get("height_cm"));
  const parsedWeight = parseOptionalWeight(
    String(formData.get("current_weight_kg") ?? ""),
  );
  if (!parsedWeight.ok) {
    return { status: "error", message: parsedWeight.error };
  }
  const weight = parsedWeight.value;

  const sex =
    sexRaw === "male" || sexRaw === "female" || sexRaw === "other" ? sexRaw : null;

  let previousWeight: number | null = null;
  try {
    previousWeight = (await getMyProfile())?.current_weight_kg ?? null;
    await upsertMyProfile({
      display_name: displayName,
      birth_date: birthDate,
      sex,
      height_cm: height,
      current_weight_kg: weight,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo guardar el perfil.",
    };
  }

  const weightChanged = shouldRecordCurrentWeight(previousWeight, weight);
  if (weightChanged) {
    try {
      await recordWeightForDate({
        date: todayInCordoba(),
        weightKg: weight,
      });
    } catch (error) {
      revalidateProfilePages();
      return {
        status: "partial",
        message:
          error instanceof Error
            ? `Perfil guardado, pero no se pudo registrar el peso. ${error.message}`
            : "Perfil guardado, pero no se pudo registrar el peso.",
      };
    }
  }

  // Sincroniza snapshots del día actual (solo hoy) para que aparezca Target/Delta
  // aunque el day_log se haya creado antes de completar el perfil.
  try {
    const supabase = await createClient();
    const today = todayInCordoba();

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

  revalidateProfilePages();
  return {
    status: "success",
    message: weightChanged
      ? `✓ Perfil guardado · Peso registrado: ${formatWeightKg(weight!)} kg`
      : "✓ Perfil guardado",
  };
}

function revalidateProfilePages() {
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/train/progress");
}
