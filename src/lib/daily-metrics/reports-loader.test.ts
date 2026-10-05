import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDailyMetricsReport, readAllDailyMetricValues } from "./reports";
import { aggregateMetricReport, buildMetricReportDays, type MetricReportValueFact } from "./reports-core";
import { addProgressIsoDays, getPreviousProgressPeriod } from "@/lib/progress/analytics";
import { resolveNutritionReportRange } from "@/lib/nutrition/reports-core";

const TODAY = "2026-10-05";
const USER = "owner";
const metricIds = ["a1000000-0000-4000-8000-000000000001", "a1000000-0000-4000-8000-000000000002", "a1000000-0000-4000-8000-000000000003"];
type Row = { user_id: string; metric_id: string; metric_date: string; value: number };

/** ~2 years of daily values for 3 metrics (> 1800 rows), with explicit zeros and gaps. */
function fixture(): Row[] {
  const rows: Row[] = [];
  for (let offset = 0; offset < 760; offset += 1) {
    const date = addProgressIsoDays(TODAY, -offset);
    metricIds.forEach((metricId, index) => {
      if ((offset + index) % 7 === 3) return; // missing day: never 0
      rows.push({ user_id: USER, metric_id: metricId, metric_date: date, value: index === 0 ? (offset % 5 === 0 ? 0 : 1000 + offset) : index === 1 ? 1.25 + (offset % 4) : 400 + (offset % 90) });
    });
  }
  rows.push({ user_id: "stranger", metric_id: metricIds[0], metric_date: TODAY, value: 99999 });
  return rows;
}

/** Minimal PostgREST emulation: filters, total order, range, and a max-rows cap per response. */
function fakeSupabase(rows: Row[], maxRows: number) {
  const calls: { from: number; to: number; returned: number }[] = [];
  const definitions = metricIds.map((id, index) => ({ id, system_key: index === 0 ? "steps" : null, name: `M${index}`, unit: index === 1 ? "L" : null,
    value_type: index === 1 ? "decimal" : index === 2 ? "duration" : "integer", target_value: index === 0 ? 10000 : null, sort_order: index, is_active: index !== 2, archived_at: index === 2 ? "2026-01-01T00:00:00Z" : null }));
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      const builder = {
        select: () => builder,
        eq(column: keyof Row, value: string) { filters.push(row => row[column] === value); return table === "user_metrics" ? Promise.resolve({ data: definitions, error: null }) : builder; },
        gte(column: keyof Row, value: string) { filters.push(row => String(row[column]) >= value); return builder; },
        lte(column: keyof Row, value: string) { filters.push(row => String(row[column]) <= value); return builder; },
        order: () => builder,
        range(from: number, to: number) {
          const sorted = rows.filter(row => filters.every(f => f(row)))
            .sort((a, b) => a.metric_date.localeCompare(b.metric_date) || a.metric_id.localeCompare(b.metric_id));
          const data = sorted.slice(from, Math.min(to + 1, from + maxRows)).map(({ metric_id, metric_date, value }) => ({ metric_id, metric_date, value: String(value) }));
          calls.push({ from, to, returned: data.length });
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { supabase: supabase as never, calls };
}

describe("Daily metrics report loader reads every row (no PostgREST truncation)", () => {
  it.each([1000, 300])("with a server cap of %i rows, all rows of the window are read once, in order", async cap => {
    const rows = fixture();
    const { supabase, calls } = fakeSupabase(rows, cap);
    const start = addProgressIsoDays(TODAY, -729);
    const read = await readAllDailyMetricValues(supabase, USER, start, TODAY);
    const expected = rows.filter(row => row.user_id === USER && row.metric_date >= start);
    expect(expected.length).toBeGreaterThan(1800);
    expect(read).toHaveLength(expected.length);
    expect(new Set(read.map(row => `${row.metric_id}:${row.metric_date}`)).size).toBe(expected.length);
    expect(calls.at(-1)!.returned).toBe(0);
    expect(calls[0].returned).toBe(cap); // a single unpaged select would have stopped here
  });

  it("1 year + previous year: summary, comparison and coverage use ALL rows (zeros kept, missing excluded)", async () => {
    const rows = fixture();
    const { supabase } = fakeSupabase(rows, 1000);
    const report = await getDailyMetricsReport({ period: "1y", metricId: metricIds[0] }, TODAY, { supabase, userId: USER });
    const range = resolveNutritionReportRange({ period: "1y" }, TODAY);
    const previous = getPreviousProgressPeriod(range);
    const own: MetricReportValueFact[] = rows.filter(row => row.user_id === USER).map(({ metric_id, metric_date, value }) => ({ metric_id, metric_date, value }));
    const expectedSummary = aggregateMetricReport(buildMetricReportDays({ range, today: TODAY, metricId: metricIds[0], values: own }), 10000, { excludeInProgressDay: true });
    const expectedPrevious = aggregateMetricReport(buildMetricReportDays({ range: previous, today: TODAY, metricId: metricIds[0], values: own }), 10000);
    expect(report.summary).toEqual(expectedSummary);
    expect(report.summary!.registeredDays).toBeGreaterThan(300);
    expect(report.summary!.minimum).toBe(0);
    expect(report.summary!.median).not.toBeNull();
    expect(report.summary!.trendDelta).not.toBeNull();
    expect(report.summary!.coverageRatio).toBeLessThan(1);
    expect(report.comparison!.previous).toEqual(expectedPrevious);
    expect(expectedPrevious.registeredDays).toBeGreaterThan(300);
    // Archived metric with history in the window stays analyzable.
    expect(report.definitions.map(definition => definition.id)).toContain(metricIds[2]);
  });
});
