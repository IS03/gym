import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260813170000_nutrition_energy_sync.sql",
);
const home = read("src/app/(app)/home/page.tsx");
const today = read("src/app/(app)/today/page.tsx");
const history = read("src/app/(app)/history/page.tsx");
const wrapper = read("src/lib/nutrition/day.ts");

describe("activación del modelo energético nutricional", () => {
  it("deriva solamente BMR y documenta maintenance/target como legacy", () => {
    expect(migration).toContain("function public.trg_profiles_derive_bmr()");
    expect(migration).toContain("new.bmr_kcal_current := v_bmr");
    expect(migration).not.toContain("new.maintenance_kcal_current :=");
    expect(migration).not.toContain("new.target_kcal_current :=");
    expect(migration).toContain("LEGACY/DEPRECATED");
  });

  it("sincroniza sólo el BMR del día de Córdoba", () => {
    expect(migration).toMatch(
      /function public\.trg_profiles_sync_today_bmr\(\)[\s\S]*America\/Argentina\/Cordoba[\s\S]*bmr_kcal_snapshot = new\.bmr_kcal_current/,
    );
    const syncStart = migration.indexOf(
      "function public.trg_profiles_sync_today_bmr()",
    );
    const syncEnd = migration.indexOf("$$;", syncStart);
    const syncFunction = migration.slice(syncStart, syncEnd);
    expect(syncFunction).not.toContain("maintenance_kcal_snapshot =");
    expect(syncFunction).not.toContain("target_kcal_snapshot =");
  });

  it("refresca workouts, overrides y sólo el período vigente de hoy", () => {
    expect(migration).toContain("tr_workout_sessions_refresh_nutrition");
    expect(migration).toContain("old.status = 'completed'");
    expect(migration).toContain("new.status = 'completed'");
    expect(migration).toContain(
      "after update of work_override, gym_override, expenditure_override_kcal",
    );
    expect(migration).toContain("new.effective_from > v_today");
    expect(migration).toContain("p.effective_from <= v_today");
    expect(migration).not.toMatch(
      /update public\.workout_session_exercises|update public\.workout_sets/i,
    );
  });

  it("evita recursión limitando el trigger a columnas fuente", () => {
    const triggerStart = migration.indexOf(
      "create trigger tr_day_logs_refresh_nutrition_overrides",
    );
    const triggerSql = migration.slice(triggerStart, triggerStart + 700);
    for (const snapshot of [
      "nutrition_target_kcal_snapshot",
      "estimated_expenditure_kcal_snapshot",
      "gym_effective_snapshot",
      "work_effective_snapshot",
      "nutrition_resolved_at",
    ]) {
      expect(triggerSql).not.toContain(snapshot);
    }
  });

  it("Home, Today e History consumen el target del read model sin fallback legacy", () => {
    expect(wrapper).toContain(
      "calories: dayLog.nutrition_target_kcal_snapshot",
    );
    for (const page of [home, today, history]) {
      expect(page).not.toContain("dayLog.target_kcal_snapshot");
      expect(page).not.toContain("dayLog.maintenance_kcal_snapshot");
    }
    expect(home).toContain("context.targets.calories");
    expect(today).toContain("context.targets.calories");
    expect(today).toContain("Sin objetivo configurado");
    expect(history).toContain("context.targets.calories");
    expect(history).toContain("createIfMissing: false");
  });
});
