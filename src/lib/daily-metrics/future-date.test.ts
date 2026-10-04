import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ requireAuthenticatedRequestContext: vi.fn() }));

import { saveDailyMetricValue } from "./server";

// M5.2: the database rejects metric values after today's product day; Web shows it plainly.
describe("daily metric future-date guard (Web)", () => {
  it("maps the database guard to a clear message instead of a raw error", async () => {
    const definition = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: { value_type: "integer" }, error: null }) };
    definition.select.mockReturnValue(definition); definition.eq.mockReturnValue(definition);
    const values = { upsert: vi.fn().mockResolvedValue({ error: { message: "metric_future_date" } }) };
    const supabase = { from: vi.fn((table: string) => table === "user_metrics" ? definition : values) };
    await expect(saveDailyMetricValue({ metricId: "metric-steps", date: "2999-01-01", value: "10" },
      { supabase, userId: "user-1" } as never)).rejects.toThrow("No se pueden registrar métricas en una fecha futura.");
  });
});
