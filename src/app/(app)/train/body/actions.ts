"use server";

import { revalidatePath } from "next/cache";
import {
  deleteWeightHistoryEntry,
  recordWeightForDate,
  updateWeightHistoryEntry,
} from "@/lib/phase1/day-log";
import {
  deleteBodyMeasurement,
  parseBodyMeasurementInput,
  updateBodyMeasurement,
  upsertBodyMeasurement,
  type BodyMeasurement,
} from "@/lib/body-measurements";
import { parseOptionalWeight, type WeightHistoryPoint } from "@/lib/weight-history";

type ActionError = { ok: false; error: string };
type WeightActionSuccess = {
  ok: true;
  entry: WeightHistoryPoint | null;
  currentWeightKg: number | null;
  syncedCurrentWeight: boolean;
};
type MeasurementActionSuccess = { ok: true; entry?: BodyMeasurement };

function errorMessage(error: unknown, fallback: string): ActionError {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

function revalidateBodyPages() {
  revalidatePath("/train/body");
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/history");
}

export async function recordWeightAction(input: {
  logDate: string;
  weight: string;
}): Promise<WeightActionSuccess | ActionError> {
  const parsed = parseOptionalWeight(input.weight);
  if (!parsed.ok || parsed.value === null) {
    return { ok: false, error: parsed.ok ? "El peso es obligatorio." : parsed.error };
  }
  try {
    const result = await recordWeightForDate({ date: input.logDate, weightKg: parsed.value });
    revalidateBodyPages();
    return { ok: true, ...result };
  } catch (error) {
    return errorMessage(error, "No se pudo registrar el peso.");
  }
}

export async function updateWeightHistoryEntryAction(input: {
  logDate: string;
  weight: string;
}): Promise<WeightActionSuccess | ActionError> {
  const parsed = parseOptionalWeight(input.weight);
  if (!parsed.ok || parsed.value === null) {
    return { ok: false, error: parsed.ok ? "El peso es obligatorio." : parsed.error };
  }
  try {
    const result = await updateWeightHistoryEntry({ logDate: input.logDate, weightKg: parsed.value });
    revalidateBodyPages();
    return { ok: true, ...result };
  } catch (error) {
    return errorMessage(error, "No se pudo actualizar el peso.");
  }
}

export async function deleteWeightHistoryEntryAction(input: {
  logDate: string;
}): Promise<WeightActionSuccess | ActionError> {
  try {
    const result = await deleteWeightHistoryEntry(input.logDate);
    revalidateBodyPages();
    return { ok: true, ...result };
  } catch (error) {
    return errorMessage(error, "No se pudo eliminar el peso.");
  }
}

type MeasurementActionInput = {
  id?: string;
  measuredOn: string;
  waistCm?: string;
  abdomenCm?: string;
  chestCm?: string;
  armCm?: string;
  armRightCm?: string;
  armLeftCm?: string;
  thighCm?: string;
  thighRightCm?: string;
  thighLeftCm?: string;
  calfRightCm?: string;
  calfLeftCm?: string;
  hipCm?: string;
  condition?: string;
  notes?: string;
};

export async function saveBodyMeasurementAction(
  input: MeasurementActionInput,
): Promise<MeasurementActionSuccess | ActionError> {
  try {
    const parsed = parseBodyMeasurementInput(input);
    const entry = input.id
      ? await updateBodyMeasurement({ ...parsed, id: input.id })
      : await upsertBodyMeasurement(parsed);
    revalidatePath("/train/body");
    return { ok: true, entry };
  } catch (error) {
    return errorMessage(error, "No se pudieron guardar las medidas.");
  }
}

export async function deleteBodyMeasurementAction(input: {
  id: string;
}): Promise<MeasurementActionSuccess | ActionError> {
  try {
    await deleteBodyMeasurement(input.id);
    revalidatePath("/train/body");
    return { ok: true };
  } catch (error) {
    return errorMessage(error, "No se pudieron eliminar las medidas.");
  }
}
