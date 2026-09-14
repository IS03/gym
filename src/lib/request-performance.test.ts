import { describe, expect, it, vi } from "vitest";
import {
  classifyRequestKind,
  logPerformance,
  measurePerformance,
  performanceErrorCategory,
  performanceErrorMetadata,
  requestPerformanceContext,
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

  it("maps the same gateway timeout to a stable code using its layer", () => {
    const error = new Error("Leer routines: Gateway Timeout", {
      cause: { message: "Gateway Timeout", status: 504 },
    });

    expect(performanceErrorMetadata(error, { layer: "auth" })).toEqual({
      errorCategory: "gateway_timeout",
      errorCode: "AUTH_TIMEOUT",
      httpStatus: 504,
    });
    expect(performanceErrorMetadata(error, { layer: "database" })).toEqual({
      errorCategory: "gateway_timeout",
      errorCode: "DATABASE_TIMEOUT",
      httpStatus: 504,
    });
  });

  it("maps transport failures without exposing their message", () => {
    expect(performanceErrorMetadata(new TypeError("fetch failed"), { layer: "transport" })).toEqual({
      errorCategory: "network",
      errorCode: "NETWORK_ERROR",
    });
  });

  it("does not turn invalid sessions or transient JWT skew into timeout or unauthorized codes", () => {
    expect(performanceErrorMetadata(
      { name: "AuthSessionMissingError", message: "Auth session missing" },
      { layer: "auth", status: "invalid_session" },
    )).toEqual({});

    expect(performanceErrorMetadata(
      { status: 401, code: "PGRST303", message: "JWT issued at future" },
      { layer: "database" },
    )).toEqual({
      errorCategory: "database",
      errorCode: "UNKNOWN",
      httpStatus: 401,
      providerCode: "PGRST303",
    });
  });

  it("captures only bounded Vercel request metadata", () => {
    expect(requestPerformanceContext(new Headers({
      rsc: "1",
      "x-vercel-id": "iad1::abc-123",
    }))).toEqual({
      requestKind: "rsc",
      vercelId: "iad1::abc-123",
    });

    const untrustedHeaders = {
      get(name: string) {
        if (name === "x-vercel-id") return "private value with spaces";
        return null;
      },
    };
    expect(requestPerformanceContext(untrustedHeaders)).toEqual({
      requestKind: "navigation",
    });
  });

  it("serializes only allowlisted technical failure fields", () => {
    const info = vi.fn();
    const privateMessage = "Gateway Timeout user@example.com Bearer secret";
    const metadata = performanceErrorMetadata({
      message: privateMessage,
      status: 504,
      code: "PGRST003",
      userId: "private-user",
      requestBody: { meal: "private meal" },
    }, { layer: "database" });

    logPerformance({
      route: "/today",
      operation: "today.quick-meals",
      durationMs: 10_001.7,
      status: "error",
      layer: "database",
      requestKind: "rsc",
      vercelId: "iad1::abc-123",
      ...metadata,
    }, { info });

    const payload = info.mock.calls[0]?.[1];
    expect(payload).toEqual({
      route: "/today",
      operation: "today.quick-meals",
      durationMs: 10_002,
      region: process.env.VERCEL_REGION ?? "local",
      status: "error",
      layer: "database",
      requestKind: "rsc",
      vercelId: "iad1::abc-123",
      errorCategory: "gateway_timeout",
      errorCode: "DATABASE_TIMEOUT",
      httpStatus: 504,
      providerCode: "PGRST003",
    });
    expect(JSON.stringify(payload)).not.toContain(privateMessage);
    expect(JSON.stringify(payload)).not.toContain("private-user");
    expect(JSON.stringify(payload)).not.toContain("private meal");
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
