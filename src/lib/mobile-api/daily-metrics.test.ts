import { describe, expect, it, vi } from "vitest";

import {
  buildMobileDailyMetricsResponse,
  handleMobileDailyMetricsRequest,
  isRejectedMobileAccessToken,
  MobileApiUnauthorizedError,
  readMobileDailyMetrics,
  type MobileDailyMetricsRepository,
  type MobileMetricDefinitionRow,
} from "./daily-metrics";

const definitions: MobileMetricDefinitionRow[] = [
  {
    id: "steps-id",
    systemKey: "steps",
    label: "Pasos",
    unit: "pasos",
    valueType: "integer",
  },
  {
    id: "water-id",
    systemKey: "water",
    label: "Agua",
    unit: "L",
    valueType: "decimal",
  },
];

function repository(
  overrides: Partial<MobileDailyMetricsRepository> = {},
): MobileDailyMetricsRepository {
  return {
    readDefinitions: vi.fn(async () => definitions),
    readValues: vi.fn(async () => []),
    readLatestRecordedDate: vi.fn(async () => null),
    ...overrides,
  };
}

describe("Mobile API v1 daily metrics", () => {
  it("rejects a missing Bearer token before reading data", async () => {
    const authenticate = vi.fn();
    const read = vi.fn();

    await expect(
      handleMobileDailyMetricsRequest(null, { authenticate, read }),
    ).resolves.toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("returns 401 for a server-confirmed invalid token", async () => {
    const result = await handleMobileDailyMetricsRequest("Bearer invalid", {
      authenticate: async () => {
        throw new MobileApiUnauthorizedError();
      },
      read: vi.fn(),
    });

    expect(result).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });

  it("distinguishes rejected access tokens from transient Auth failures", () => {
    expect(isRejectedMobileAccessToken({ status: 401 })).toBe(true);
    expect(isRejectedMobileAccessToken({ code: "bad_jwt" })).toBe(true);
    expect(isRejectedMobileAccessToken({ code: "invalid_jwt" })).toBe(true);
    expect(
      isRejectedMobileAccessToken({
        status: 503,
        message: "Gateway Timeout",
      }),
    ).toBe(false);
    expect(isRejectedMobileAccessToken(new TypeError("fetch failed"))).toBe(
      false,
    );
  });

  it("uses only the user derived by authentication and returns a minimal DTO", async () => {
    const read = vi.fn(async (context) =>
      buildMobileDailyMetricsResponse("2026-09-19", definitions, [
        { metricId: "steps-id", value: 8_000 },
      ]),
    );
    const context = {
      userId: "authenticated-user",
      repository: repository(),
    };
    const result = await handleMobileDailyMetricsRequest("Bearer valid", {
      authenticate: async () => context,
      read,
    });

    expect(read).toHaveBeenCalledWith(context);
    expect(result).toEqual({
      status: 200,
      body: {
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
      },
    });
    expect(result.body).not.toHaveProperty("userId");
  });

  it("falls back from an empty today to the latest recorded date", async () => {
    const source = repository({
      readValues: vi.fn(async (_userId, date) =>
        date === "2026-09-18"
          ? [{ metricId: "water-id", value: 3 }]
          : [],
      ),
      readLatestRecordedDate: vi.fn(async () => "2026-09-18"),
    });

    await expect(
      readMobileDailyMetrics(source, "authenticated-user", "2026-09-19"),
    ).resolves.toEqual({
      date: "2026-09-18",
      metrics: [
        {
          id: "water-id",
          key: "water",
          label: "Agua",
          unit: "L",
          valueType: "decimal",
          value: 3,
        },
      ],
    });
  });

  it("returns a genuine empty response without inventing zero", async () => {
    await expect(
      readMobileDailyMetrics(
        repository(),
        "authenticated-user",
        "2026-09-19",
      ),
    ).resolves.toEqual({ date: "2026-09-19", metrics: [] });

    expect(
      buildMobileDailyMetricsResponse("2026-09-19", definitions, [
        { metricId: "steps-id", value: 0 },
      ]).metrics[0]?.value,
    ).toBe(0);
  });

  it("returns unavailable instead of false empty when the read fails", async () => {
    const result = await handleMobileDailyMetricsRequest("Bearer valid", {
      authenticate: async () => ({
        userId: "authenticated-user",
        repository: repository(),
      }),
      read: async () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(result).toEqual({
      status: 503,
      body: { error: "DATA_UNAVAILABLE" },
    });
  });
});
