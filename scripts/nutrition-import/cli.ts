import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { normalizeWorkbook } from "./normalize.ts";
import { buildDryRunPlan } from "./plan.ts";
import { readWorkbookSnapshot } from "./source.ts";
import type { ProductionSnapshot } from "./types.ts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

export function assertPrivateOutputPath(path: string, cwd = process.cwd()): string {
  const absolute = resolve(cwd, path);
  const local = relative(cwd, absolute);
  const root = local.split(sep)[0];
  if (local.startsWith("..") || (root !== "tmp" && root !== "temp")) {
    throw new Error("El reporte real sólo puede escribirse dentro de tmp/ o temp/ (ignorados por Git).");
  }
  return absolute;
}

async function main() {
  const sourcePath = argument("--source");
  const productionPath = argument("--production");
  const outputPath = assertPrivateOutputPath(argument("--out"));
  const workbook = await readWorkbookSnapshot(sourcePath);
  const production = JSON.parse(await readFile(productionPath, "utf8")) as ProductionSnapshot;
  const plan = buildDryRunPlan(normalizeWorkbook(workbook), production);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

  const counts = Map.groupBy(plan.dayLogs, (day) => day.classification);
  console.log(JSON.stringify({
    source_name: plan.sourceName,
    source_sha256: plan.sourceSha256,
    range: plan.sourceRange,
    day_logs: Object.fromEntries([...counts].map(([key, value]) => [key, value.length])),
    meals: {
      detailed: plan.meals.detailed,
      legacy_summaries: plan.meals.legacySummaries,
      inactive: plan.meals.inactive,
    },
    foods: {
      total: plan.foods.length,
      partial: plan.foods.filter((food) => [food.calories, food.proteinG, food.carbsG, food.fatG].some((value) => value === null)).length,
    },
    body_measurements: {
      inserts: plan.bodyMeasurements.inserts,
      no_op: plan.bodyMeasurements.noOps,
      skipped_undated: plan.bodyMeasurements.skippedUndated,
      conflicts: plan.bodyMeasurements.conflicts.length,
    },
    nutrition_events: {
      inserts: plan.nutritionEvents.inserts,
      no_op: plan.nutritionEvents.noOps,
      conflicts: plan.nutritionEvents.conflicts.length,
    },
    reconciliation: plan.reconciliation,
    warnings: plan.anomalies.filter((anomaly) => anomaly.severity === "warning"),
    blockers: plan.blockers,
    APPLY_READY: plan.applyReady,
    report: outputPath,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
