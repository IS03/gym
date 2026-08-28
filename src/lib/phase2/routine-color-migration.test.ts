import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(import.meta.dirname, "../../../supabase/migrations/20260827013625_routine_color_preset_keys.sql"),
  "utf8",
);

describe("routine color migration", () => {
  it("normalizes known hex values, preserves null and constrains persisted keys", () => {
    for (const [hex, key] of Object.entries({
      "#a855f7": "violet",
      "#3b82f6": "blue",
      "#06b6d4": "cyan",
      "#22c55e": "green",
      "#eab308": "yellow",
      "#f97316": "orange",
      "#ef4444": "rose",
    })) {
      expect(migration).toContain(`when '${hex}' then '${key}'`);
    }
    expect(migration).toContain("where color is not null");
    expect(migration).toContain("drop constraint if exists routines_color_format_check");
    expect(migration).toContain("check (");
    expect(migration).toContain("'violet', 'indigo', 'blue', 'cyan', 'green', 'yellow', 'orange', 'rose'");
  });

  it("makes the initial-plan RPC write and validate preset keys", () => {
    expect(migration).toContain("v_routine_color text");
    expect(migration).toContain("Color de rutina inválido");
    expect(migration).toContain("color = v_routine_color");
    expect(migration).toContain("revoke all on function public.import_training_plan(jsonb) from public");
    expect(migration).toContain("grant execute on function public.import_training_plan(jsonb) to authenticated, service_role");
  });
});
