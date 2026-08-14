import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertPrivateOutputPath } from "./cli.ts";
import { buildHistoricalImportSql, isAlreadyImported, type ApplyMode } from "./apply.ts";
import type { DryRunPlan, ProductionSnapshot } from "./types.ts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Falta el guard explícito --apply");
  const target = argument("--target");
  if (target !== "production") throw new Error("--target debe ser production");
  const expectedSha = argument("--expected-sha");
  const mode = argument("--mode") as ApplyMode;
  if (mode !== "rollback" && mode !== "commit") throw new Error("--mode debe ser rollback o commit");
  const plan = JSON.parse(await readFile(argument("--plan"), "utf8")) as DryRunPlan;
  const production = JSON.parse(await readFile(argument("--production"), "utf8")) as ProductionSnapshot;
  if (plan.sourceSha256 !== expectedSha) throw new Error("El SHA del plan no coincide con --expected-sha");
  if (isAlreadyImported(plan, production)) {
    console.log(JSON.stringify({ status: "ALREADY_IMPORTED", source_sha256: plan.sourceSha256 }, null, 2));
    return;
  }
  const outputPath = assertPrivateOutputPath(argument("--out"));
  const sql = buildHistoricalImportSql({ plan, production, expectedSha, target, mode });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, sql, "utf8");
  console.log(JSON.stringify({ status: "SQL_GENERATED", mode, source_sha256: plan.sourceSha256, bytes: sql.length, output: outputPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
