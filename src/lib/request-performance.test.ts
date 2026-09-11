import { describe, expect, it, vi } from "vitest";
import {
  classifyRequestKind,
  logPerformance,
  measurePerformance,
  performanceErrorCategory,
} from "./request-performance";

describe("structured request performance logs", () => {
  it("keeps the payload bounded and free of request data", () => {
    const info = vi.fn();

    logPerformance(
      {
        route: "/home",
        operation: "home.profile",
        durationMs: 12.6,
        status: "ok",
      },
      { info },
    );

    expect(info).toHaveBeenCalledWith("[perf]", {
      route: "/home",
      operation: "home.profile",
      durationMs: 13,
      region: process.env.VERCEL_REGION ?? "local",
      status: "ok",
    });
  });

  it.each([
    [{ "next-router-prefetch": "1", rsc: "1" }, "prefetch"],
    [{ "next-router-prefetch": "2", rsc: "1" }, "prefetch"],
    [{ "next-router-prefetch": "3", rsc: "1" }, "prefetch"],
    [{ "next-router-segment-prefetch": "/__PAGE__", rsc: "1" }, "prefetch"],
    [{ purpose: "prefetch" }, "prefetch"],
    [{ "sec-purpose": "prefetch;prerender" }, "prefetch"],
    [{ rsc: "1" }, "rsc"],
    [{}, "navigation"],
  ] as const)("classifies request headers without logging their values", (input, expected) => {
    const headers = new Headers(input);
    expect(classifyRequestKind(headers)).toBe(expected);
  });

  it("classifies timeout and gateway failures without logging messages", () => {
    expect(performanceErrorCategory(new DOMException("late", "TimeoutError"))).toBe(
      "timeout",
    );
    expect(performanceErrorCategory({ message: "Gateway Timeout", code: "504" })).toBe(
      "gateway_timeout",
    );
  });

  it("logs failures and preserves the original rejection", async () => {
    const error = new TypeError("fetch failed");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      measurePerformance(
        { route: "/today", operation: "today.nutrition" },
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);

    expect(info).toHaveBeenCalledWith(
      "[perf]",
      expect.objectContaining({
        route: "/today",
        operation: "today.nutrition",
        status: "error",
        errorCategory: "network",
      }),
    );
    info.mockRestore();
  });
});
