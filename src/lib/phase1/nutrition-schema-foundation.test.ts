import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260813150000_nutrition_schema_foundation.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("fundación del schema nutricional", () => {
  it("es aditiva sobre day_logs y conserva sus conceptos legacy", () => {
    expect(sql).toMatch(/alter table public\.day_logs/i);
    expect(sql).not.toMatch(/drop\s+table\s+(if\s+exists\s+)?public\.day_logs/i);
    expect(sql).not.toMatch(/rename\s+to\s+day_logs/i);
    expect(sql).toContain("nutrition_target_kcal_snapshot");
    expect(sql).toContain("estimated_expenditure_kcal_snapshot");
    expect(sql).toContain("delta_vs_nutrition_target");
    expect(sql).toContain("energy_balance_kcal");
    expect(sql).toContain("delta_vs_target = case");
    expect(sql).toContain("delta_vs_maintenance = case");
  });

  it("crea únicamente las cinco tablas nuevas de esta fase", () => {
    const createdTables = [...sql.matchAll(/create table public\.(\w+)/gi)].map(
      ([, table]) => table,
    );

    expect(createdTables).toEqual([
      "nutrition_goal_periods",
      "expenditure_rule_periods",
      "work_schedule_periods",
      "nutrition_import_runs",
      "foods",
    ]);
  });

  it("mantiene separados períodos, snapshots e indicadores legacy", () => {
    expect(sql).toContain("unique (user_id, effective_from)");
    expect(sql).toContain("protein_no_gym_g");
    expect(sql).toContain("protein_gym_g");
    expect(sql).toContain("on delete restrict");
    expect(sql).not.toContain("effective_to");
  });

  it("protege agregación, idempotencia y resúmenes históricos en Postgres", () => {
    expect(sql).toContain("final_carbs_g");
    expect(sql).toContain("final_fat_g");
    expect(sql).toContain("meal_entries_legacy_import_unique");
    expect(sql).toContain("meal_entries_idempotency_key_unique");
    expect(sql).toContain("meal_entries_enforce_day_composition");
    expect(sql).toMatch(/from public\.day_logs[\s\S]*for update/i);
  });

  it("endurece sólo las funciones internas alcanzadas por la fase", () => {
    for (const functionName of [
      "set_updated_at",
      "trg_foods_normalize_name",
      "meal_entries_enforce_day_composition",
      "meal_entries_enforce_owner",
      "recalculate_day_log",
      "trg_meal_entries_recalculate",
      "prevent_versioned_period_rewrite",
    ]) {
      const start = sql.indexOf(`function public.${functionName}`);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(sql.slice(start, start + 300)).toContain("security invoker");
      expect(sql.slice(start, start + 300)).toContain("set search_path = ''");
    }
  });
});
