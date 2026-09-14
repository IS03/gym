import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthenticatedRequestContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  requireAuthenticatedRequestContext: mocks.requireAuthenticatedRequestContext,
}));
vi.mock("@/lib/request-performance", () => ({
  measurePerformance: async (_input: unknown, operation: () => Promise<unknown>) => operation(),
}));

import { saveDailyMetricValues } from "./server";

function metricsQuery(data: unknown[]) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  return builder;
}

describe("atomic daily metric writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the full autosave as one transactional RPC including removals", async () => {
    const definitions = metricsQuery([
      { id: "00000000-0000-4000-8000-000000000001", value_type: "integer", is_active: true },
      { id: "00000000-0000-4000-8000-000000000002", value_type: "decimal", is_active: true },
    ]);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    mocks.requireAuthenticatedRequestContext.mockResolvedValue({
      userId: "user-1",
      supabase: { from: vi.fn(() => definitions), rpc },
    });

    await saveDailyMetricValues({
      date: "2026-09-14",
      values: {
        "00000000-0000-4000-8000-000000000001": "9000",
        "00000000-0000-4000-8000-000000000002": "",
      },
    });

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_daily_metric_values", {
      p_metric_date: "2026-09-14",
      p_values: {
        "00000000-0000-4000-8000-000000000001": 9000,
        "00000000-0000-4000-8000-000000000002": null,
      },
      p_historical: false,
    });
  });

  it("keeps the RPC invoker-scoped, owned and transactional", () => {
    const migration = readFileSync(
      "supabase/migrations/20260914120000_r3_atomic_daily_metric_values.sql",
      "utf8",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain("m.user_id = v_user_id");
    expect(migration).toContain("delete from public.daily_metric_values");
    expect(migration).toContain("on conflict (user_id, metric_date, metric_id)");
    expect(migration).not.toContain("security definer");
  });
});
