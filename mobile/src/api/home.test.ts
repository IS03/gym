import { describe, expect, it, vi } from "vitest";

import type { MobileHomeResponse } from "../../../src/lib/mobile-api/contracts";
import type { MobileClientHeaders } from "../native/versioning";
import type { MobileApiClientDependencies } from "./client";
import { fetchMobileHome, parseMobileHomeResponse } from "./home";

const responseBody: MobileHomeResponse = {
  date: "2026-09-20",
  profile: { status: "ok", data: { displayName: "Ignacio" } },
  nutrition: {
    status: "ok",
    data: {
      calories: 2_000,
      calorieTarget: 2_200,
      proteinG: 135,
      proteinTargetG: 140,
      mealCount: 4,
      waterL: 2.5,
      waterTargetL: 3,
      energyBalanceKcal: -180,
    },
  },
  training: {
    activeSession: { status: "ok", data: null },
    week: {
      status: "ok",
      data: {
        summary: {
          weekStart: "2026-09-14",
          weekEnd: "2026-09-20",
          sessions: 3,
          sets: 54,
          minutes: 225,
          trainingDays: ["2026-09-15", "2026-09-17", "2026-09-19"],
        },
        todaySessions: [],
      },
    },
  },
};

function dependencies(
  fetchImplementation: typeof fetch,
  accessToken: string | null = "access-token",
): MobileApiClientDependencies {
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

describe("mobile Home client", () => {
  it("sends Bearer and version metadata to the versioned Home endpoint", async () => {
    const fetchImplementation = vi.fn(async () => Response.json(responseBody));

    await expect(
      fetchMobileHome(dependencies(fetchImplementation)),
    ).resolves.toEqual({ status: "ok", data: responseBody });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://www.ownlevel.fit/api/mobile/v1/home",
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

  it("parses success, explicit partial unavailable, null active, and empty sessions", () => {
    expect(parseMobileHomeResponse(responseBody)).toEqual(responseBody);
    if (responseBody.training.week.status !== "ok") {
      throw new Error("Expected an available week fixture");
    }
    const partial: MobileHomeResponse = {
      ...responseBody,
      nutrition: { status: "unavailable" },
      training: {
        activeSession: { status: "unavailable" },
        week: {
          status: "ok",
          data: {
            ...responseBody.training.week.data,
            todaySessions: [],
          },
        },
      },
    };

    expect(parseMobileHomeResponse(partial)).toEqual(partial);
  });

  it("preserves real zeroes and rejects missing values instead of inventing zero", () => {
    const zeroes: MobileHomeResponse = {
      ...responseBody,
      nutrition: {
        status: "ok",
        data: {
          calories: 0,
          calorieTarget: 2_200,
          proteinG: 0,
          proteinTargetG: 140,
          mealCount: 0,
          waterL: null,
          waterTargetL: 3,
          energyBalanceKcal: 0,
        },
      },
    };
    expect(parseMobileHomeResponse(zeroes)).toEqual(zeroes);

    const malformed = structuredClone(zeroes) as Record<string, unknown>;
    const nutrition = malformed.nutrition as Record<string, unknown>;
    nutrition.data = {
      ...(nutrition.data as Record<string, unknown>),
      calories: null,
    };
    expect(parseMobileHomeResponse(malformed)).toBeNull();
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

    await expect(fetchMobileHome(dependencies(unauthorized))).resolves.toEqual({
      status: "unauthorized",
    });
    await expect(fetchMobileHome(dependencies(unavailable))).resolves.toEqual({
      status: "unavailable",
    });
    await expect(fetchMobileHome(dependencies(networkFailure))).resolves.toEqual({
      status: "unavailable",
    });
  });
});
