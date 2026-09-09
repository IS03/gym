import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260909155017_configurable_daily_metrics.sql",
  "utf8",
);
const ownerIndexMigration = readFileSync(
  "supabase/migrations/20260909155207_daily_metric_values_owner_fk_index.sql",
  "utf8",
);
const product = readFileSync("src/lib/nutrition/product.ts", "utf8");

describe("PR72 — esquema y compatibilidad de métricas", () => {
  it("crea definiciones y valores genéricos con ownership y unicidad diaria", () => {
    expect(migration).toContain("create table public.user_metrics");
    expect(migration).toContain("create table public.daily_metric_values");
    expect(migration).toContain("unique (user_id, metric_date, metric_id)");
    expect(migration).toContain("foreign key (metric_id, user_id)");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("target_value is null or target_value >= 0");
    expect(ownerIndexMigration).toContain("daily_metric_values(metric_id, user_id)");
  });

  it("aísla ambas tablas por usuario para todas las operaciones", () => {
    expect(migration.match(/enable row level security/g)).toHaveLength(2);
    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migration).toContain(`user_metrics_${operation}_own`);
      expect(migration).toContain(`daily_metric_values_${operation}_own`);
    }
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).toContain("to authenticated");
  });

  it("preserva identidad, archiva historial y sólo permite borrar custom sin valores", () => {
    expect(migration).toContain("system_metric_identity_is_immutable");
    expect(migration).toContain("metric_with_history_cannot_change_meaning");
    expect(migration).toContain("system_metric_cannot_be_deleted");
    expect(migration).toContain("references public.user_metrics(id, user_id)\n    on delete restrict");
  });

  it("backfillea Pasos, Agua y Mate sin inventar Sueño ni convertir null en cero", () => {
    expect(migration).toContain("('steps'::text, d.steps::numeric)");
    expect(migration).toContain("('water'::text, d.water_l::numeric)");
    expect(migration).toContain("('mate'::text, d.mate_l::numeric)");
    expect(migration).toContain("where source.value is not null");
    const backfill = migration.slice(migration.indexOf("insert into public.daily_metric_values"));
    expect(backfill).not.toContain("('sleep'::text");
    expect(migration).not.toContain("drop column steps");
    expect(migration).not.toContain("drop column water_l");
    expect(migration).not.toContain("drop column mate_l");
  });

  it("mueve la escritura canónica de Today al modelo genérico con proyección legacy", () => {
    const activity = product.slice(
      product.indexOf("export async function updateDailyActivity"),
      product.indexOf("export async function updateWorkOverride"),
    );
    expect(activity).toContain('rpc("save_daily_activity_metrics"');
    expect(activity).toContain("p_steps:");
    expect(activity).toContain("p_water_l:");
    expect(activity).toContain("p_mate_l:");
    expect(activity).not.toContain('.from("day_logs").update');
    expect(migration).toContain("tr_daily_metric_values_project_legacy");
  });

  it("persiste un orden activo atómico y rechaza listas parciales o ajenas", () => {
    expect(migration).toContain("create function public.reorder_user_metrics");
    expect(migration).toContain("invalid_metric_order");
    expect(migration).toContain("with ordinality");
    expect(migration).toContain("m.user_id = v_user_id and m.is_active");
  });
});
