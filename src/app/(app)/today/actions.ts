"use server";

import { revalidatePath } from "next/cache";
import {
  createMeal,
  softDeleteMeal,
  updateMeal,
} from "@/lib/phase1/day-log";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createMealAction(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = parseNumber(formData.get("final_calories"));
  const protein = parseNumber(formData.get("final_protein_g"));
  const intent = String(formData.get("intent") ?? "draft");

  await createMeal({
    date,
    title: title || undefined,
    description: description || undefined,
    final_calories: calories ?? undefined,
    final_protein_g: protein ?? undefined,
    status: intent === "confirmed" ? "confirmed" : "draft",
  });

  revalidatePath("/today");
  revalidatePath("/history");
}

export async function updateMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const calories = parseNumber(formData.get("final_calories"));
  const protein = parseNumber(formData.get("final_protein_g"));
  const status = String(formData.get("status") ?? "").trim();

  await updateMeal({
    id,
    title: title ? title : null,
    description: description ? description : null,
    final_calories: calories,
    final_protein_g: protein,
    status:
      status === "confirmed" || status === "needs_review" || status === "draft"
        ? status
        : undefined,
  });

  revalidatePath("/today");
  revalidatePath("/history");
}

export async function confirmMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await updateMeal({ id, status: "confirmed" });
  revalidatePath("/today");
  revalidatePath("/history");
}

export async function softDeleteMealAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await softDeleteMeal(id);
  revalidatePath("/today");
  revalidatePath("/history");
}

