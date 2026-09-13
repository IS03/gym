import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { dailyHistoryDetailHref, dailyHistorySessionHref } from "../history/daily-history-navigation";
import { nutritionReportPath } from "../nutrition/report-navigation";
import { trainingAnalysisWorkspacePath } from "../phase2/training-analysis-navigation";

const source = (path: string) => readFileSync(path, "utf8");

describe("Progress V2 integration navigation", () => {
  it("keeps exact custom dates in analytical deep links", () => {
    expect(trainingAnalysisWorkspacePath({
      view: "muscles",
      period: "custom",
      customFrom: "2026-08-01",
      customTo: "2026-08-31",
      routineId: null,
      muscleKey: "legs",
    })).toBe("/train/progress?view=muscles&period=custom&from=2026-08-01&to=2026-08-31&muscle=legs");
    expect(nutritionReportPath({
      preset: "custom",
      start: "2026-08-01",
      end: "2026-08-31",
      comparison: "previous",
      basePath: "/progress/metrics",
      query: { metric: "custom-id" },
    })).toBe("/progress/metrics?period=custom&metric=custom-id&from=2026-08-01&to=2026-08-31&compare=previous");
  });

  it("preserves calendar origin through daily-history drill-down", () => {
    expect(dailyHistoryDetailHref("2026-08-12", { source: "calendar", month: "2026-08" })).toBe(
      "/history?date=2026-08-12&from=calendar&month=2026-08",
    );
    expect(dailyHistorySessionHref("session-id", "2026-08-12", { source: "calendar", month: "2026-08" })).toBe(
      "/train/session/session-id?return=%2Fhistory%3Fdate%3D2026-08-12%26from%3Dcalendar%26month%3D2026-08",
    );
    expect(source("src/app/(app)/history/page.tsx")).toContain("dailyHistorySessionHref(session.id, requestedDate, origin)");
    expect(source("src/app/(app)/train/session/[id]/page.tsx")).toContain('startsWith("/history?")');
    expect(source("src/app/(app)/train/session/[id]/session-editor.tsx")).toContain('returnHref ?? "/train"');
  });

  it("connects every analytical header back to Home with its current period", () => {
    for (const path of [
      "src/app/(app)/train/progress/page.tsx",
      "src/app/(app)/today/reports/page.tsx",
      "src/app/(app)/train/body/page.tsx",
      "src/app/(app)/progress/metrics/page.tsx",
      "src/app/(app)/progress/relationships/page.tsx",
    ]) {
      expect(source(path), path).toContain("progressHomeHref");
    }
  });

  it("keeps factual destinations navigable and mobile controls at least 44px", () => {
    expect(source("src/app/(app)/calendar/page.tsx")).toContain('href="/progress"');
    expect(source("src/app/(app)/history/page.tsx")).toContain('href="/progress"');
    expect(source("src/components/training/training-analysis-workspace.tsx")).toContain("min-h-11");
    expect(source("src/components/body/body-progress-chart.tsx")).not.toContain("min-h-9");
    expect(source("src/components/body/body-measurements.tsx")).toContain("env(safe-area-inset-bottom)");
    expect(source("src/components/body/weight-history.tsx")).toContain("env(safe-area-inset-bottom)");
  });

  it("constrains long relationship labels instead of overflowing mobile", () => {
    expect(source("src/app/(app)/progress/page.tsx")).toContain("min-w-0 flex-1 truncate");
    expect(source("src/app/(app)/progress/relationships/page.tsx")).toContain("min-w-0 flex-1 truncate");
    expect(source("src/components/progress/relationship-result.tsx")).toContain("flex-wrap");
  });
});
