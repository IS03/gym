import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/calendar/page.tsx");
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

  it("lo expone desde Progreso y el sidebar, sin cambiar el preview de Entrenar", () => {
    expect(progress).toContain('href="/calendar"');
    expect(sidebar).toContain('href: "/calendar", label: "Calendario"');
    expect(preview).toContain('href={`/train/calendar?month=${month}`}');
  });
});
