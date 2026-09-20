import { describe, expect, it } from "vitest";

import type { MobileNutritionTodayResponse } from "../../../src/lib/mobile-api/contracts";
import {
  initialMobileNutritionState,
  mobileNutritionReducer,
} from "./nutrition-state";

const data = {
  date: "2026-09-20",
  summary: { status: "unavailable" },
  meals: { status: "ok", data: [] },
} satisfies MobileNutritionTodayResponse;

describe("native Nutrition state", () => {
  it("keeps existing data visible while a manual or foreground refresh runs", () => {
    const ready = mobileNutritionReducer(initialMobileNutritionState, {
      type: "load_finished",
      result: { status: "ok", data },
    });
    expect(mobileNutritionReducer(ready, { type: "load_started" })).toEqual({
      status: "ready",
      data,
      refreshing: true,
    });
  });

  it("does not convert unavailable or unauthorized into empty Nutrition", () => {
    expect(
      mobileNutritionReducer(initialMobileNutritionState, {
        type: "load_finished",
        result: { status: "unavailable" },
      }),
    ).toEqual({ status: "unavailable" });
    expect(
      mobileNutritionReducer(initialMobileNutritionState, {
        type: "load_finished",
        result: { status: "unauthorized" },
      }),
    ).toEqual({ status: "unauthorized" });
  });
});
