"use server";

import { revalidatePath } from "next/cache";
import {
  archiveMetric,
  createMetric,
  deleteMetricIfUnused,
  reorderMetrics,
  restoreMetric,
  updateMetric,
} from "@/lib/daily-metrics/server";

type Result = { ok: true } | { ok: false; error: string };

async function run(task: () => Promise<void>): Promise<Result> {
  try {
    await task();
    revalidatePath("/settings/metrics");
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No pudimos guardar el cambio." };
  }
}

export async function createMetricAction(input: Parameters<typeof createMetric>[0]) {
  return run(() => createMetric(input));
}

export async function updateMetricAction(input: Parameters<typeof updateMetric>[0]) {
  return run(() => updateMetric(input));
}

export async function archiveMetricAction(id: string) {
  return run(() => archiveMetric(id));
}

export async function restoreMetricAction(id: string) {
  return run(() => restoreMetric(id));
}

export async function deleteMetricAction(id: string) {
  return run(() => deleteMetricIfUnused(id));
}

export async function reorderMetricsAction(ids: string[]) {
  return run(() => reorderMetrics(ids));
}
