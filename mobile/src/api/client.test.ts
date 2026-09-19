import { describe, expect, it, vi } from "vitest";

import {
  fetchMobileDailyMetrics,
  parseMobileDailyMetricsResponse,
} from "./client";
import type { MobileClientHeaders } from "../native/versioning";

const responseBody = {
  date: "2026-09-19",
  metrics: [
    {
      id: "steps-id",
      key: "steps",
      label: "Pasos",
      unit: "pasos",
      valueType: "integer",
      value: 8_000,
    },
  ],
};

function dependencies(
  fetchImplementation: typeof fetch,
  accessToken: string | null = "access-token",
) {
  return {
    baseUrl: "https://www.ownlevel.fit",
    fetchImplementation,
    getAccessToken: vi.fn(async () => accessToken),
    getVersionHeaders: vi.fn(
      async (): Promise<MobileClientHeaders> => ({
        "X-OWNLEVEL-App-Version": "1.0",
        "X-OWNLEVEL-Build": "1",
        "X-OWNLEVEL-Bridge-Version": "1",
        "X-OWNLEVEL-Platform": "ios",
      }),
    ),
  };
}

describe("mobile daily metrics client", () => {
  it("sends the session Bearer and M4 version metadata", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json(responseBody),
    );

    await expect(
      fetchMobileDailyMetrics(dependencies(fetchImplementation)),
    ).resolves.toEqual({ status: "ok", data: responseBody });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://www.ownlevel.fit/api/mobile/v1/daily-metrics",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "X-OWNLEVEL-App-Version": "1.0",
          "X-OWNLEVEL-Build": "1",
          "X-OWNLEVEL-Bridge-Version": "1",
          "X-OWNLEVEL-Platform": "ios",
        }),
      }),
    );
  });

  it("preserves a valid empty response", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({ date: "2026-09-19", metrics: [] }),
    );

    await expect(
      fetchMobileDailyMetrics(dependencies(fetchImplementation)),
    ).resolves.toEqual({
      status: "ok",
      data: { date: "2026-09-19", metrics: [] },
    });
  });

  it("keeps confirmed 401 separate from transient failures", async () => {
    const unauthorized = vi.fn(async () =>
      Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    );
    const unavailable = vi.fn(async () =>
      Response.json({ error: "DATA_UNAVAILABLE" }, { status: 503 }),
    );
    const networkFailure = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      fetchMobileDailyMetrics(dependencies(unauthorized)),
    ).resolves.toEqual({ status: "unauthorized" });
    await expect(
      fetchMobileDailyMetrics(dependencies(unavailable)),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      fetchMobileDailyMetrics(dependencies(networkFailure)),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("does not turn missing values into zero and rejects malformed DTOs", () => {
    expect(
      parseMobileDailyMetricsResponse({
        date: "2026-09-19",
        metrics: [{ ...responseBody.metrics[0], value: 0 }],
      })?.metrics[0]?.value,
    ).toBe(0);
    expect(
      parseMobileDailyMetricsResponse({
        date: "2026-09-19",
        metrics: [{ ...responseBody.metrics[0], value: null }],
      }),
    ).toBeNull();
  });

  it("does not call the API when the local session has no access token", async () => {
    const fetchImplementation = vi.fn();
    const input = dependencies(
      fetchImplementation as unknown as typeof fetch,
      null,
    );

    await expect(fetchMobileDailyMetrics(input)).resolves.toEqual({
      status: "unauthorized",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
