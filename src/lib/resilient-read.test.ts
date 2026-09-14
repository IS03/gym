import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mapReadResult, resilientRead } from "./resilient-read";

describe("resilient reads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps successful empty data distinct from an unavailable read", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const loaded = await resilientRead(
      { route: "/test", operation: "test.loaded", layer: "database" },
      async () => [] as string[],
    );
    const unavailable = await resilientRead(
      { route: "/test", operation: "test.unavailable", layer: "database" },
      async () => { throw new Error("private provider detail"); },
    );

    expect(loaded).toEqual({ status: "ok", data: [] });
    expect(unavailable).toEqual({ status: "unavailable" });
  });

  it("records the measured failure once before isolating it without leaking the raw error", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = Object.assign(new Error("private user payload"), { status: 504 });

    const result = await resilientRead(
      { route: "/today", operation: "today.metrics", layer: "database" },
      async () => { throw error; },
    );

    expect(result).toEqual({ status: "unavailable" });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith("[perf]", expect.objectContaining({
      route: "/today",
      operation: "today.metrics",
      status: "error",
      errorCategory: "gateway_timeout",
      errorCode: "DATABASE_TIMEOUT",
    }));
    expect(JSON.stringify(info.mock.calls[0]?.[1])).not.toContain("private user payload");
  });

  it("maps only loaded data and preserves unavailable metadata", () => {
    expect(mapReadResult({ status: "ok", data: 2 }, (value) => value * 3))
      .toEqual({ status: "ok", data: 6 });
    expect(mapReadResult({ status: "unavailable" }, () => 0))
      .toEqual({ status: "unavailable" });
  });

  it("offers an accessible manual refresh and prevents repeated taps while pending", () => {
    const retry = readFileSync("src/components/ui/read-unavailable.tsx", "utf8");
    expect(retry).toContain("router.refresh()");
    expect(retry).toContain("disabled={pending}");
    expect(retry).toContain('aria-busy={pending}');
    expect(retry).toContain('role="status"');
    expect(retry).toContain('pending ? "Reintentando…" : "Reintentar"');
  });
});
