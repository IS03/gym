import { describe, expect, it } from "vitest";

import type { MobileHomeResponse } from "../../../src/lib/mobile-api/contracts";
import {
  initialMobileHomeState,
  mobileHomeReducer,
} from "./home-state";

const data = {
  date: "2026-09-20",
  profile: { status: "ok", data: { displayName: "Ignacio" } },
  nutrition: { status: "unavailable" },
  training: {
    activeSession: { status: "ok", data: null },
    week: { status: "unavailable" },
  },
} satisfies MobileHomeResponse;

describe("native Home state", () => {
  it("moves from loading to success and marks an explicit refresh", () => {
    const ready = mobileHomeReducer(initialMobileHomeState, {
      type: "load_finished",
      result: { status: "ok", data },
    });
    expect(ready).toEqual({ status: "ready", data, refreshing: false });
    expect(mobileHomeReducer(ready, { type: "load_started" })).toEqual({
      status: "ready",
      data,
      refreshing: true,
    });
  });

  it("does not turn unavailable or unauthorized into empty Home data", () => {
    expect(
      mobileHomeReducer(initialMobileHomeState, {
        type: "load_finished",
        result: { status: "unavailable" },
      }),
    ).toEqual({ status: "unavailable" });
    expect(
      mobileHomeReducer(initialMobileHomeState, {
        type: "load_finished",
        result: { status: "unauthorized" },
      }),
    ).toEqual({ status: "unauthorized" });
  });
});
