"use server";

import { revalidatePath } from "next/cache";
import { getMyProfile, upsertMyProfile } from "../../../lib/phase1/profile";
import { listWeightHistory, recordWeightForDate } from "../../../lib/phase1/day-log";
import { todayInCordoba } from "../../../lib/phase2/cordoba-date";
import {
  formatWeightKg,
  parseOptionalWeight,
  shouldRecordProfileWeight,
} from "../../../lib/weight-history";
import type { ProfileSaveState } from "./profile-state";

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
  let hasWeightHistory = false;
  let shouldRecordWeight = false;
  try {
    const [profile, weightHistory] = await Promise.all([
      getMyProfile(),
      listWeightHistory(1),
    ]);
    previousWeight = profile?.current_weight_kg ?? null;
    hasWeightHistory = weightHistory.length > 0;
    if (weight === null && hasWeightHistory) {
      return {
        status: "error",
        message:
          "El peso actual corresponde al último registro. Para quitarlo, eliminá ese registro desde Entrenar → Cuerpo.",
      };
    }

    shouldRecordWeight = shouldRecordProfileWeight({
      previousWeight,
      nextWeight: weight,
      hasWeightHistory,
    });
    await upsertMyProfile({
      display_name: displayName,
      birth_date: birthDate,
      sex,
      height_cm: height,
      // Si hay una medición nueva, la escritura atómica del day_log pasa a ser
      // quien sincroniza peso actual, derivados y snapshot del día.
      current_weight_kg: shouldRecordWeight ? previousWeight : weight,
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "No se pudo guardar el perfil.",
    };
  }

  if (shouldRecordWeight) {
    try {
      await recordWeightForDate({
        date: todayInCordoba(),
        weightKg: weight!,
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

  revalidateProfilePages();
  return {
    status: "success",
    message: shouldRecordWeight
      ? `✓ Perfil guardado · Peso registrado: ${formatWeightKg(weight!)} kg`
      : "✓ Perfil guardado",
  };
}

function revalidateProfilePages() {
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/train/body");
}
