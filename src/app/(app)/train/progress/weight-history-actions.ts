"use server";

import { revalidatePath } from "next/cache";
import {
  deleteWeightHistoryEntry,
  updateWeightHistoryEntry,
} from "@/lib/phase1/day-log";
import { parseOptionalWeight, type WeightHistoryPoint } from "@/lib/weight-history";

type WeightHistoryActionResult =
  | { ok: true; entry?: WeightHistoryPoint }
  | { ok: false; error: string };

export async function updateWeightHistoryEntryAction(input: {
  logDate: string;
  weight: string;
}): Promise<WeightHistoryActionResult> {
  const parsed = parseOptionalWeight(input.weight);
  if (!parsed.ok || parsed.value === null) {
    return { ok: false, error: parsed.ok ? "El peso es obligatorio." : parsed.error };
  }

  try {
    const entry = await updateWeightHistoryEntry({
      logDate: input.logDate,
      weightKg: parsed.value,
    });
    revalidatePath("/train/progress");
    return { ok: true, entry };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el peso.",
    };
  }
}

export async function deleteWeightHistoryEntryAction(input: {
  logDate: string;
}): Promise<WeightHistoryActionResult> {
  try {
    await deleteWeightHistoryEntry(input.logDate);
    revalidatePath("/train/progress");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar el peso.",
    };
  }
}
