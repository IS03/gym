import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  requireAuthenticatedRequestContext: vi.fn(),
}));

import { getActiveDailyMetrics } from "./server";

const systemMetrics = ["steps", "water", "mate", "sleep"].map((key, index) => ({
  id: `metric-${key}`,
  user_id: "user-1",
  system_key: key,
  name: key,
  unit: key === "steps" ? "pasos" : "L",
  value_type: key === "steps" ? "integer" : "decimal",
  target_value: null,
  sort_order: index,
  is_active: true,
  archived_at: null,
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
}));

function queryResult(data: unknown, started?: () => void) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: PromiseLike<{ data: unknown; error: null }>["then"];
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  for (const method of ["select", "eq", "order"] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.then = (onFulfilled, onRejected) => {
    started?.();
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  };
  return builder;
}

describe("Today active metrics read path", () => {
  it("reads definitions and daily values in parallel without ensuring existing defaults", async () => {
    const started: string[] = [];
    const definitions = queryResult(systemMetrics, () => started.push("definitions"));
    const values = queryResult([
      { metric_id: "metric-water", value: 1.5 },
    ], () => started.push("values"));
    const from = vi.fn((table: string) => {
      if (table === "user_metrics") return definitions;
      if (table === "daily_metric_values") return values;
      throw new Error(`unexpected table ${table}`);
    });
    const rpc = vi.fn();

    const result = await getActiveDailyMetrics("2026-09-11", {
      userId: "user-1",
      supabase: { from, rpc },
    } as never);

    expect(started).toEqual(["definitions", "values"]);
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toHaveLength(4);
    expect(result.find((metric) => metric.id === "metric-water")?.value).toBe(1.5);
  });

  it("ensures and rereads definitions only when a system default is missing", async () => {
    const firstDefinitions = queryResult([]);
    const refreshedDefinitions = queryResult(systemMetrics);
    const values = queryResult([]);
    let definitionsRead = 0;
    const from = vi.fn((table: string) => {
      if (table === "user_metrics") {
        definitionsRead += 1;
        return definitionsRead === 1 ? firstDefinitions : refreshedDefinitions;
      }
      if (table === "daily_metric_values") return values;
      throw new Error(`unexpected table ${table}`);
    });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

    const result = await getActiveDailyMetrics("2026-09-11", {
      userId: "user-1",
      supabase: { from, rpc },
    } as never);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("ensure_user_metrics");
    expect(definitionsRead).toBe(2);
    expect(result).toHaveLength(4);
  });

  it("does not recreate an intentionally archived system metric", async () => {
    const definitions = queryResult(systemMetrics.map((metric) =>
      metric.system_key === "mate"
        ? { ...metric, is_active: false, archived_at: "2026-09-11T00:00:00Z" }
        : metric
    ));
    const values = queryResult([]);
    const from = vi.fn((table: string) =>
      table === "user_metrics" ? definitions : values
    );
    const rpc = vi.fn();

    const result = await getActiveDailyMetrics("2026-09-11", {
      userId: "user-1",
      supabase: { from, rpc },
    } as never);

    expect(rpc).not.toHaveBeenCalled();
    expect(result.map((metric) => metric.system_key)).not.toContain("mate");
  });
});
