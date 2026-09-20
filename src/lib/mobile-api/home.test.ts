import { describe, expect, it, vi } from "vitest";

import type { Profile } from "@/lib/phase1/profile";
import { MobileApiUnauthorizedError } from "./auth";
import {
  buildMobileHomeResponse,
  handleMobileHomeRequest,
  type MobileHomeSources,
} from "./home";

const date = "2026-09-20";

function sources(
  overrides: Partial<MobileHomeSources> = {},
): MobileHomeSources {
  return {
    profile: {
      status: "ok",
      data: { display_name: "Ignacio Senestrari" } as Profile,
    },
    nutrition: {
      status: "ok",
      data: {
        dayLog: {
          total_calories_consumed: 2_000,
          total_protein_g: 135,
        },
        mealCount: 4,
        context: {
          targets: { calories: 2_200, proteinG: 140, waterL: 3 },
          consumption: { waterL: 2.5 },
          metrics: { energyBalanceKcal: -180 },
        },
      },
    },
    activeSession: { status: "ok", data: null },
    training: {
      status: "ok",
      data: {
        currentWeek: {
          weekStart: "2026-09-14",
          weekEnd: "2026-09-20",
          sessions: 3,
          exercises: 18,
          sets: 54,
          minutes: 225,
          volumeKg: 12_500,
          routines: { Push: 2, Pull: 1 },
          muscleGroups: { Pecho: 18 },
          trainingDays: ["2026-09-15", "2026-09-17", "2026-09-19"],
        },
        todaySessions: [],
      },
    },
    ...overrides,
  };
}

describe("Mobile API v1 Home", () => {
  it("rejects a missing Bearer before authentication or reads", async () => {
    const authenticate = vi.fn();
    const read = vi.fn();

    await expect(
      handleMobileHomeRequest(null, { authenticate, read }),
    ).resolves.toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(authenticate).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("uses only the context derived from the token and exposes no user id", async () => {
    const authenticatedContext = { userId: "authenticated-user" };
    const body = buildMobileHomeResponse(date, sources());
    const read = vi.fn(async () => body);

    const result = await handleMobileHomeRequest("Bearer valid", {
      authenticate: async () => authenticatedContext,
      read,
    });

    expect(read).toHaveBeenCalledWith(authenticatedContext);
    expect(result).toEqual({ status: 200, body });
    expect(result.body).not.toHaveProperty("userId");
  });

  it("keeps Nutrition unavailable while Training and the semantic date survive", () => {
    const result = buildMobileHomeResponse(
      date,
      sources({ nutrition: { status: "unavailable" } }),
    );

    expect(result.date).toBe(date);
    expect(result.nutrition).toEqual({ status: "unavailable" });
    expect(result.training.week.status).toBe("ok");
    expect(result.training.activeSession).toEqual({
      status: "ok",
      data: null,
    });
  });

  it("keeps Training unavailable while real Nutrition zeroes survive", () => {
    const result = buildMobileHomeResponse(
      date,
      sources({
        nutrition: {
          status: "ok",
          data: {
            dayLog: {
              total_calories_consumed: 0,
              total_protein_g: 0,
            },
            mealCount: 0,
            context: {
              targets: { calories: 2_200, proteinG: 140, waterL: 3 },
              consumption: { waterL: null },
              metrics: { energyBalanceKcal: 0 },
            },
          },
        },
        activeSession: { status: "unavailable" },
        training: { status: "unavailable" },
      }),
    );

    expect(result.nutrition).toEqual({
      status: "ok",
      data: expect.objectContaining({
        calories: 0,
        proteinG: 0,
        mealCount: 0,
        waterL: null,
        energyBalanceKcal: 0,
      }),
    });
    expect(result.training.activeSession).toEqual({ status: "unavailable" });
    expect(result.training.week).toEqual({ status: "unavailable" });
  });

  it("preserves a real active session and completed sessions for today", () => {
    const baseSources = sources();
    if (baseSources.training.status !== "ok") {
      throw new Error("Expected an available training fixture");
    }
    const result = buildMobileHomeResponse(
      date,
      sources({
        activeSession: {
          status: "ok",
          data: {
            id: "active-session",
            name: "Push",
            logDate: date,
            startedAt: "2026-09-20T18:00:00Z",
            exercisesCompleted: 3,
            totalExercises: 6,
            completedSets: 9,
            totalSets: 18,
            progressPercent: 50,
          },
        },
        training: {
          status: "ok",
          data: {
            ...baseSources.training.data,
            todaySessions: [
              {
                id: "completed-session",
                routineId: null,
                routineName: "Pull",
                logDate: date,
                startedAt: "2026-09-20T14:00:00Z",
                endedAt: "2026-09-20T15:00:00Z",
                durationMilliseconds: 3_600_000,
                exercisesCompleted: 5,
                completedSets: 15,
                muscleGroups: ["Espalda"],
              },
            ],
          },
        },
      }),
    );

    expect(result.training.activeSession).toEqual({
      status: "ok",
      data: expect.objectContaining({ id: "active-session", progressPercent: 50 }),
    });
    expect(result.training.week).toEqual({
      status: "ok",
      data: expect.objectContaining({
        todaySessions: [
          expect.objectContaining({
            id: "completed-session",
            status: "completed",
          }),
        ],
      }),
    });
  });

  it("returns 503 instead of false empty when every product source fails", async () => {
    const result = await handleMobileHomeRequest("Bearer valid", {
      authenticate: async () => ({ userId: "authenticated-user" }),
      read: async () =>
        buildMobileHomeResponse(
          date,
          sources({
            nutrition: { status: "unavailable" },
            activeSession: { status: "unavailable" },
            training: { status: "unavailable" },
          }),
        ),
    });

    expect(result).toEqual({
      status: 503,
      body: { error: "DATA_UNAVAILABLE" },
    });
  });

  it("keeps confirmed invalid Auth separate from transient infrastructure", async () => {
    const invalid = await handleMobileHomeRequest("Bearer invalid", {
      authenticate: async () => {
        throw new MobileApiUnauthorizedError();
      },
      read: vi.fn(),
    });
    const transient = await handleMobileHomeRequest("Bearer valid", {
      authenticate: async () => {
        throw new TypeError("fetch failed");
      },
      read: vi.fn(),
    });

    expect(invalid).toEqual({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(transient).toEqual({
      status: 503,
      body: { error: "DATA_UNAVAILABLE" },
    });
  });
});
