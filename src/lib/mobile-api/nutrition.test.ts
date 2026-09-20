import { describe, expect, it, vi } from "vitest";

import type { DayLog, MealEntry } from "@/lib/phase1/types";
import type { NutritionContext } from "@/lib/nutrition/types";
import {
  handleMobileAuthenticatedRequest,
  handleMobileMutationRequest,
  MobileApiNotFoundError,
  MobileApiUnauthorizedError,
} from "./auth";
import {
  buildMobileNutritionTodayResponse,
  MobileNutritionUnavailableError,
  parseMobileMealId,
  parseMobileMealMutation,
} from "./nutrition";

const date = "2026-09-20";
const mealId = "4f0e2089-79b4-4720-9ae8-a6a88a0a66af";

const dayLog = {
  id: "day-1",
  total_calories_consumed: 0,
  total_protein_g: 0,
  total_carbs_g: 0,
  total_fat_g: 0,
} as DayLog;

const context = {
  targets: { calories: 2_100, proteinG: 140, waterL: 3 },
  consumption: {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    waterL: null,
    mateL: null,
    steps: null,
  },
  metrics: { deltaVsNutritionTarget: null, energyBalanceKcal: 0 },
} as NutritionContext;

const meal = {
  id: mealId,
  title: "Almuerzo",
  description: null,
  final_calories: 550,
  final_protein_g: 35.5,
  final_carbs_g: null,
  final_fat_g: 12,
  consumed_at: "2026-09-20T15:00:00.000Z",
  updated_at: "2026-09-20T15:00:00.000Z",
} as MealEntry;

describe("Mobile API v1 Nutrition", () => {
  it("returns the minimal DTO while preserving real zeroes, nulls, and meal order", () => {
    const result = buildMobileNutritionTodayResponse(date, {
      summary: {
        status: "ok",
        data: { dayLog, mealCount: 1, context },
      },
      meals: { status: "ok", data: [meal] },
    });

    expect(result).toEqual({
      date,
      summary: {
        status: "ok",
        data: {
          calories: 0,
          calorieTarget: 2_100,
          proteinG: 0,
          proteinTargetG: 140,
          carbsG: 0,
          fatG: 0,
          mealCount: 1,
          waterL: null,
          waterTargetL: 3,
          energyBalanceKcal: 0,
        },
      },
      meals: {
        status: "ok",
        data: [
          {
            id: mealId,
            title: "Almuerzo",
            description: null,
            calories: 550,
            proteinG: 35.5,
            carbsG: null,
            fatG: 12,
            consumedAt: "2026-09-20T15:00:00.000Z",
            updatedAt: "2026-09-20T15:00:00.000Z",
          },
        ],
      },
    });
    expect(result).not.toHaveProperty("userId");
  });

  it("distinguishes confirmed empty meals from an unavailable meal read", () => {
    const empty = buildMobileNutritionTodayResponse(date, {
      summary: {
        status: "ok",
        data: { dayLog, mealCount: 0, context },
      },
      meals: { status: "ok", data: [] },
    });
    const partial = buildMobileNutritionTodayResponse(date, {
      summary: {
        status: "ok",
        data: { dayLog, mealCount: 0, context },
      },
      meals: { status: "unavailable" },
    });

    expect(empty.meals).toEqual({ status: "ok", data: [] });
    expect(partial.meals).toEqual({ status: "unavailable" });
  });

  it("returns unavailable rather than false empty when both reads fail", () => {
    expect(() =>
      buildMobileNutritionTodayResponse(date, {
        summary: { status: "unavailable" },
        meals: { status: "unavailable" },
      }),
    ).toThrow(MobileNutritionUnavailableError);
  });

  it("normalizes comma decimals and ignores arbitrary ownership input", () => {
    expect(
      parseMobileMealMutation(
        {
          title: " Cena ",
          description: " ",
          calories: "620",
          proteinG: "42,5",
          carbsG: "70.25",
          fatG: "18",
          idempotencyKey: "meal-operation-1",
          userId: "attacker-controlled",
        },
        { requireIdempotencyKey: true },
      ),
    ).toEqual({
      title: "Cena",
      description: null,
      calories: 620,
      proteinG: 42.5,
      carbsG: 70.25,
      fatG: 18,
      idempotencyKey: "meal-operation-1",
    });
  });

  it("rejects invalid numeric values and malformed meal ids", () => {
    expect(() =>
      parseMobileMealMutation(
        {
          title: "Cena",
          description: "",
          calories: "120,5",
          proteinG: "-1",
          carbsG: "",
          fatG: "",
          idempotencyKey: "operation",
        },
        { requireIdempotencyKey: true },
      ),
    ).toThrow("calorías");
    expect(() => parseMobileMealId("not-a-uuid")).toThrow("comida");
    expect(parseMobileMealId(mealId)).toBe(mealId);
  });

  it("keeps missing or invalid Bearer separate from transient read failures", async () => {
    const authenticate = vi.fn();
    const read = vi.fn();
    await expect(
      handleMobileAuthenticatedRequest(null, { authenticate, read }),
    ).resolves.toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });
    expect(authenticate).not.toHaveBeenCalled();

    await expect(
      handleMobileAuthenticatedRequest("Bearer invalid", {
        authenticate: async () => {
          throw new MobileApiUnauthorizedError();
        },
        read,
      }),
    ).resolves.toEqual({ status: 401, body: { error: "UNAUTHORIZED" } });

    await expect(
      handleMobileAuthenticatedRequest("Bearer valid", {
        authenticate: async () => {
          throw new TypeError("fetch failed");
        },
        read,
      }),
    ).resolves.toEqual({
      status: 503,
      body: { error: "DATA_UNAVAILABLE" },
    });
  });

  it("maps mutation not-found without leaking a different user's row", async () => {
    await expect(
      handleMobileMutationRequest("Bearer valid", {
        authenticate: async () => ({ userId: "authenticated-user" }),
        mutate: async () => {
          throw new MobileApiNotFoundError("La comida ya no está disponible.");
        },
      }),
    ).resolves.toEqual({
      status: 404,
      body: {
        error: "NOT_FOUND",
        message: "La comida ya no está disponible.",
      },
    });
  });
});
