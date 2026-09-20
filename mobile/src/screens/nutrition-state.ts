import type { MobileNutritionTodayResponse } from "../../../src/lib/mobile-api/contracts";
import type { MobileNutritionTodayResult } from "../api/nutrition";

export type MobileNutritionState =
  | { status: "loading" }
  | {
      status: "ready";
      data: MobileNutritionTodayResponse;
      refreshing: boolean;
    }
  | { status: "unavailable" }
  | { status: "unauthorized" };

export type MobileNutritionEvent =
  | { type: "load_started" }
  | { type: "load_finished"; result: MobileNutritionTodayResult };

export const initialMobileNutritionState: MobileNutritionState = {
  status: "loading",
};

export function mobileNutritionReducer(
  state: MobileNutritionState,
  event: MobileNutritionEvent,
): MobileNutritionState {
  if (event.type === "load_started") {
    return state.status === "ready"
      ? { ...state, refreshing: true }
      : { status: "loading" };
  }

  if (event.result.status === "ok") {
    return { status: "ready", data: event.result.data, refreshing: false };
  }
  return { status: event.result.status };
}
