import { describe, expect, it, vi } from "vitest";

import type {
  MobileMealMutationPayload,
  MobileNutritionTodayResponse,
} from "../../../src/lib/mobile-api/contracts";
import type { MobileClientHeaders } from "../native/versioning";
import type { MobileApiClientDependencies } from "./client";
import {
  createMobileNutritionMeal,
  deleteMobileNutritionMeal,
  fetchMobileNutritionToday,
  parseMobileNutritionTodayResponse,
  updateMobileNutritionMeal,
} from "./nutrition";

const mealId = "4f0e2089-79b4-4720-9ae8-a6a88a0a66af";
const meal = {
  id: mealId,
  title: "Cena",
  description: null,
  calories: 620,
  proteinG: 42.5,
  carbsG: null,
  fatG: 18,
  consumedAt: "2026-09-20T23:00:00.000Z",
  updatedAt: "2026-09-20T23:00:00.000Z",
};
const responseBody: MobileNutritionTodayResponse = {
  date: "2026-09-20",
  summary: {
    status: "ok",
    data: {
      calories: 0,
      calorieTarget: 2_100,
      proteinG: 0,
      proteinTargetG: 140,
      carbsG: 0,
      fatG: 0,
      mealCount: 0,
      waterL: null,
      waterTargetL: 3,
      energyBalanceKcal: 0,
    },
  },
  meals: { status: "ok", data: [] },
};

function dependencies(fetchImplementation: typeof fetch): MobileApiClientDependencies {
  return {
    baseUrl: "https://www.ownlevel.fit",
    fetchImplementation,
    getAccessToken: vi.fn(async () => "access-token"),
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

const payload: MobileMealMutationPayload = {
  title: "Cena",
  description: "",
  calories: "620",
  proteinG: "42,5",
  carbsG: "",
  fatG: "18",
  idempotencyKey: "operation-1",
};

describe("mobile Nutrition client", () => {
  it("parses real zeroes, confirmed empty, and partial unavailable", () => {
    expect(parseMobileNutritionTodayResponse(responseBody)).toEqual(responseBody);
    expect(
      parseMobileNutritionTodayResponse({
        ...responseBody,
        summary: { status: "unavailable" },
        meals: { status: "ok", data: [meal] },
      }),
    ).toEqual({
      ...responseBody,
      summary: { status: "unavailable" },
      meals: { status: "ok", data: [meal] },
    });

    const malformed = structuredClone(responseBody) as Record<string, unknown>;
    const summary = malformed.summary as { data: Record<string, unknown> };
    delete summary.data.calories;
    expect(parseMobileNutritionTodayResponse(malformed)).toBeNull();
  });

  it("adds Bearer and M4 metadata to the read without caching private data", async () => {
    const fetchImplementation = vi.fn(async () => Response.json(responseBody));
    await expect(
      fetchMobileNutritionToday(dependencies(fetchImplementation)),
    ).resolves.toEqual({ status: "ok", data: responseBody });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://www.ownlevel.fit/api/mobile/v1/nutrition/today",
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

  it("uses explicit POST/PATCH/DELETE requests and never retries a write", async () => {
    const fetchImplementation = vi.fn(async (_url, init) => {
      if (init?.method === "DELETE") return Response.json({ deleted: true });
      return Response.json({ meal });
    });
    const deps = dependencies(fetchImplementation);

    await expect(createMobileNutritionMeal(payload, deps)).resolves.toEqual({
      status: "ok",
      data: { meal },
    });
    await expect(updateMobileNutritionMeal(mealId, payload, deps)).resolves.toEqual({
      status: "ok",
      data: { meal },
    });
    await expect(deleteMobileNutritionMeal(mealId, deps)).resolves.toEqual({
      status: "ok",
      data: { deleted: true },
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(fetchImplementation.mock.calls.map(([, init]) => init?.method)).toEqual([
      "POST",
      "PATCH",
      "DELETE",
    ]);
    expect(fetchImplementation.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify(payload),
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("keeps validation, not-found, confirmed 401, and transient failures distinct", async () => {
    const validation = vi.fn(async () =>
      Response.json(
        { error: "VALIDATION_ERROR", message: "Revisá las calorías." },
        { status: 400 },
      ),
    );
    const missing = vi.fn(async () =>
      Response.json(
        { error: "NOT_FOUND", message: "La comida ya no está disponible." },
        { status: 404 },
      ),
    );
    const unauthorized = vi.fn(async () =>
      Response.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    );
    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(
      createMobileNutritionMeal(payload, dependencies(validation)),
    ).resolves.toEqual({ status: "validation", message: "Revisá las calorías." });
    await expect(
      updateMobileNutritionMeal(mealId, payload, dependencies(missing)),
    ).resolves.toEqual({
      status: "not_found",
      message: "La comida ya no está disponible.",
    });
    await expect(
      deleteMobileNutritionMeal(mealId, dependencies(unauthorized)),
    ).resolves.toEqual({ status: "unauthorized" });
    await expect(
      createMobileNutritionMeal(payload, dependencies(network)),
    ).resolves.toEqual({ status: "unavailable" });
  });
});
