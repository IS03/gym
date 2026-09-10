import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const migration = source("supabase/migrations/20260909180000_daily_nutrition_overrides_v2.sql");
const todayPage = source("src/app/(app)/today/page.tsx");
const activity = source("src/app/(app)/today/today-activity.tsx");
const editor = source("src/app/(app)/today/day-context-editor.tsx");
const panel = source("src/app/(app)/today/day-activity-panel.tsx");
const metricServer = source("src/lib/daily-metrics/server.ts");
const product = source("src/lib/nutrition/product.ts");

describe("PR73 — actividad dinámica y correcciones diarias V2", () => {
  it("lee sólo métricas activas, respeta sort_order y registra por metric_id", () => {
    expect(metricServer).toContain("export async function getActiveDailyMetrics");
    expect(metricServer).toContain('.eq("is_active", true)');
    expect(metricServer).toContain('.order("sort_order").order("created_at")');
    expect(metricServer).toContain("metric_id: item.metricId");
    expect(metricServer).toContain('onConflict: "user_id,metric_date,metric_id"');
    expect(todayPage).toContain("getActiveDailyMetrics(today, auth)");
    expect(editor).toContain("metrics.map");
    expect(editor).not.toContain("grid-cols-3 gap-2 rounded-xl");
  });

  it("usa renderers genéricos, duración humana y las primeras tres métricas", () => {
    expect(editor).toContain('metric.value_type === "duration"');
    expect(editor).toContain("Horas");
    expect(editor).toContain("Minutos");
    expect(editor).toContain('inputMode={metric.value_type === "integer" ? "numeric" : "decimal"}');
    expect(panel).toContain("metrics.slice(0, 3)");
    expect(activity).toContain("formatDailyMetricProgress");
    expect(activity).not.toContain("Registrá pasos, agua y mate");
  });

  it("conserva Pasos en el editor genérico sin cargar historia en Today", () => {
    expect(editor).toContain("metrics.map");
    expect(editor).not.toContain("<StepsSummary");
    expect(panel).not.toContain('metric.name === "Bicicleta"');
    expect(todayPage).not.toContain("getStepsOverview(today, auth)");
  });

  it("persisten objetivo y gasto automáticos separados de sus overrides", () => {
    for (const column of [
      "nutrition_target_override_kcal",
      "nutrition_target_automatic_kcal_snapshot",
      "estimated_expenditure_automatic_kcal_snapshot",
    ]) expect(migration).toContain(column);
    expect(migration).toContain("nutrition_target_automatic_kcal_snapshot = nutrition_target_kcal_snapshot");
    expect(migration).toContain("estimated_expenditure_automatic_kcal_snapshot = estimated_expenditure_kcal_snapshot");
    expect(migration).not.toContain("drop column");
  });

  it("aplica overrides sólo al day_log y restaura su snapshot automático", () => {
    expect(product).toContain('.update({ nutrition_target_override_kcal: kcal })');
    expect(product).toContain('.update({ expenditure_override_kcal: kcal })');
    expect(product).toContain('.eq("id", input.dayLogId).eq("user_id", userId)');
    expect(migration).toContain("coalesce(\n      v_day.nutrition_target_override_kcal");
    expect(migration).toContain("v_day.estimated_expenditure_automatic_kcal_snapshot");
    expect(migration).toContain("v_day.total_calories_consumed - v_estimated_expenditure");
    expect(migration).toContain("v_day.total_calories_consumed - v_target");
  });

  it("elimina Trabajo y entrenamiento manual sólo de la UI nueva", () => {
    expect(editor).not.toContain("Usar horario habitual");
    expect(editor).not.toContain("Guardar trabajo");
    expect(editor).not.toContain("Entrenamiento histórico sin sesión");
    expect(editor).toContain("Objetivo nutricional");
    expect(editor).toContain("Gasto estimado");
    expect(editor).toContain("Usar valor automático");
    expect(migration).toContain("v_day.work_override is not null");
    expect(migration).toContain("v_day.gym_override is true");
  });
});
