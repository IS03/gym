"use server";

import { revalidatePath } from "next/cache";
import { upsertMyProfile } from "@/lib/phase1/profile";

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
  const activityRaw = String(formData.get("activity_level") ?? "").trim();
  const goalRaw = String(formData.get("goal_type") ?? "").trim();

  const sex =
    sexRaw === "male" || sexRaw === "female" || sexRaw === "other" ? sexRaw : null;
  const activity =
    activityRaw === "sedentary" ||
    activityRaw === "light" ||
    activityRaw === "moderate" ||
    activityRaw === "active" ||
    activityRaw === "very_active"
      ? activityRaw
      : null;
  const goal =
    goalRaw === "lose" || goalRaw === "maintain" || goalRaw === "gain" ? goalRaw : null;

  await upsertMyProfile({
    display_name: displayName,
    birth_date: birthDate,
    sex,
    height_cm: height,
    current_weight_kg: weight,
    activity_level: activity,
    goal_type: goal,
  });

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
}

