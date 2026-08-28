import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260813163000_nutrition_day_engine.sql",
  ),
  "utf8",
);
const wrapper = readFileSync(
  join(process.cwd(), "src/lib/nutrition/day.ts"),
  "utf8",
);
const historyPage = readFileSync(
  join(process.cwd(), "src/app/(app)/history/page.tsx"),
  "utf8",
);

describe("motor diario nutricional", () => {
  it("separa resolución read-only de materialización explícita", () => {
    expect(migration).toMatch(
      /function public\.resolve_nutrition_context\(p_log_date date\)/i,
    );
    expect(migration).toMatch(
      /function public\.refresh_nutrition_day\(p_day_log_id uuid\)/i,
    );
    expect(migration).toMatch(/resolve_nutrition_context[\s\S]*security invoker/i);
    expect(migration).toMatch(/refresh_nutrition_day[\s\S]*security invoker/i);
    expect(migration).toContain("set search_path = ''");
  });

  it("mantiene las reglas de trabajo, gym y períodos en Postgres", () => {
    expect(migration).toContain("p.effective_from <= p_log_date");
    expect(migration).toContain("date_part('isodow', p_log_date)");
    expect(migration).toContain("v_day.work_override is not null");
    expect(migration).toContain("s.status = 'completed'");
    expect(migration).not.toMatch(/status\s*=\s*'in_progress'/i);
    expect(migration).not.toMatch(/status\s*=\s*'discarded'/i);
    expect(migration).not.toMatch(/steps[^\n]*[+\-*\/]/i);
  });

  it("preserva el motor legacy y refresca con el mismo lock del agregado", () => {
    expect(migration).not.toContain("bmr_kcal_current =");
    expect(migration).not.toMatch(/\n\s+maintenance_kcal_snapshot\s*=/);
    expect(migration).not.toMatch(/\n\s+target_kcal_snapshot\s*=/);
    expect(migration).toMatch(
      /refresh_nutrition_day[\s\S]*from public\.day_logs d[\s\S]*for update/i,
    );
    expect(migration).not.toMatch(/create\s+trigger[\s\S]*workout_sessions/i);
  });

  it("mantiene get_or_create sin user_id y materializa sólo la inserción nueva", () => {
    expect(migration).toContain(
      "function public.get_or_create_day_log(p_log_date date)",
    );
    expect(migration).not.toMatch(/get_or_create_day_log\([^)]*user_id/i);
    expect(migration).toMatch(
      /on conflict \(user_id, log_date\) do nothing[\s\S]*if found then[\s\S]*refresh_nutrition_day/i,
    );
  });

  it("hace que History lea sin crear ni refrescar", () => {
    expect(historyPage).toContain("createIfMissing: false");
    expect(wrapper).toMatch(
      /if \(createIfMissing\)[\s\S]*getOrCreateDayLog\(date(?:, auth)?\)[\s\S]*else[\s\S]*\.from\("day_logs"\)/,
    );
    expect(historyPage).not.toContain("getOrCreateDayLog");
    expect(historyPage).not.toContain("refresh_nutrition_day");
  });
});
