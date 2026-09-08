import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260908170000_nutrition_plan_energy_v2.sql", "utf8");
const coherenceMigration = readFileSync("supabase/migrations/20260908220654_pr71_1_plan_energy_coherence.sql", "utf8");

describe("PR71 — persistencia versionada", () => {
  it("crea configuraciones v2 separadas, periodizadas y con RLS", () => {
    expect(migration).toContain("create table public.nutrition_plan_periods");
    expect(migration).toContain("create table public.nutrition_plan_weekdays");
    expect(migration).toContain("create table public.energy_config_periods");
    expect(migration).toContain("effective_from date not null");
    expect(migration).toContain("alter table public.nutrition_plan_periods enable row level security");
    expect(migration).toContain("alter table public.nutrition_plan_weekdays enable row level security");
    expect(migration).toContain("alter table public.energy_config_periods enable row level security");
    expect(migration).toContain("(select auth.uid()) = user_id");
  });

  it("versiona el modo automático o personalizado en la configuración V2", () => {
    expect(coherenceMigration).toContain("base_expenditure_mode");
    expect(coherenceMigration).toContain("custom_base_expenditure_kcal");
    expect(coherenceMigration).toContain("when v_energy.base_expenditure_mode = 'custom'");
    expect(coherenceMigration).toContain("v_base_used");
    expect(coherenceMigration).toContain("p_log_date < v_today and v_day.nutrition_resolved_at is not null");
    expect(coherenceMigration).not.toContain("drop table public.work_schedule_periods");
  });

  it("preserva snapshots pasados y usa sólo entrenamientos finalizados", () => {
    expect(migration).toContain("p_log_date < v_today and v_day.nutrition_resolved_at is not null");
    expect(migration).toContain("s.status = 'completed'");
    expect(migration).toContain("case when v_completed_training then v_plan.training_calorie_delta_kcal else 0 end");
    expect(migration).toContain("case when v_completed_training then v_energy.training_expenditure_delta_kcal else 0 end");
    expect(migration).not.toContain("drop table public.work_schedule_periods");
    expect(migration).not.toContain("drop table public.expenditure_rule_periods");
  });

  it("guarda una sola versión por día civil de Córdoba", () => {
    expect(migration).toContain("time zone 'America/Argentina/Cordoba'");
    expect(migration).toContain("on conflict (user_id, effective_from) do update");
    expect(migration).toContain("save_nutrition_plan_v2");
    expect(migration).toContain("save_energy_config_v2");
  });
});
