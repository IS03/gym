import type { MobileHomeResponse } from "../../../src/lib/mobile-api/contracts";
import type { MobileHomeResult } from "../api/home";

export type MobileHomeState =
  | { status: "loading" }
  | { status: "ready"; data: MobileHomeResponse; refreshing: boolean }
  | { status: "unavailable" }
  | { status: "unauthorized" };

export type MobileHomeEvent =
  | { type: "load_started" }
  | { type: "load_finished"; result: MobileHomeResult };

export const initialMobileHomeState: MobileHomeState = { status: "loading" };

export function mobileHomeReducer(
  state: MobileHomeState,
  event: MobileHomeEvent,
): MobileHomeState {
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
