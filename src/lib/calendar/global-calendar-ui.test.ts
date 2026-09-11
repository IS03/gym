import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/calendar/page.tsx");
const today = source("src/app/(app)/today/page.tsx");
const loader = source("src/lib/calendar/global-calendar.ts");
const progress = source("src/app/(app)/progress/page.tsx");
const sidebar = source("src/components/layout/desktop-sidebar.tsx");
const preview = source("src/components/training/training-month-preview.tsx");

describe("navegación del calendario global", () => {
  it("mantiene el calendario global como navegación temporal hacia History", () => {
    expect(page).toContain('dailyHistoryDetailHref(day.date, { source: "calendar", month })');
    expect(loader).toContain("buildMonthGrid");
    expect(page).toContain("aria-disabled=\"true\"");
    expect(page).toContain('{ key: "hasMetrics", label: "Métricas"');
    expect(loader).toContain('.from("daily_metric_values")');
    expect(loader).not.toContain('select("id,log_date,steps,water_l,mate_l');
  });

  it("expone el calendario directo desde Nutrición y mantiene la leyenda debajo de la grilla", () => {
    expect(today).toContain('<Link href="/calendar"');
    expect(today).toContain("<CalendarDays");
    expect(today).toContain("Calendario");
    expect(today).not.toContain('href="/today/reports"');
    expect(today).not.toContain("ChartNoAxesCombined");

    expect(page).not.toContain("Nutrición, métricas, entrenamiento y cuerpo, día por día.");
    expect(page).not.toContain("Tocá un día para ver el historial completo.");
    expect(page).toContain('className="flex flex-col gap-2 border-t pt-4');
    expect(page.indexOf('role="grid"')).toBeLessThan(page.indexOf('aria-label="Indicadores del calendario"'));
    expect(page.indexOf('label: "Nutrición"')).toBeLessThan(page.indexOf('label: "Métricas"'));
    expect(page.indexOf('label: "Métricas"')).toBeLessThan(page.indexOf('label: "Entreno"'));
    expect(page.indexOf('label: "Entreno"')).toBeLessThan(page.indexOf('label: "Cuerpo"'));
  });

  it("lo expone desde Progreso y el sidebar, separado del acceso rápido de Entrenar", () => {
    expect(progress).toContain('href="/calendar"');
    expect(sidebar).toContain('href: "/calendar", label: "Calendario"');
    expect(preview).toContain('trainingDayHref(day.date, { source: "train" })');
    expect(preview).not.toContain('href={`/train/calendar?month=${month}`}');
  });
});
