import { describe, expect, it } from "vitest";

import {
  initialMobileAuthState,
  mobileAuthReducer,
  type AuthIdentity,
} from "./state";

const identity: AuthIdentity = {
  displayName: "Test User",
  email: "user@example.test",
};

describe("mobile auth state", () => {
  it("does not turn a transient failure into logout", () => {
    const authenticated = mobileAuthReducer(initialMobileAuthState, {
      type: "session_confirmed",
      identity,
    });

    expect(
      mobileAuthReducer(authenticated, { type: "transient_failure" }),
    ).toEqual({ status: "auth_unavailable", identity });
  });

  it("treats a confirmed invalid session as signed out", () => {
    const authenticated = mobileAuthReducer(initialMobileAuthState, {
      type: "session_confirmed",
      identity,
    });

    expect(mobileAuthReducer(authenticated, { type: "session_invalid" })).toEqual(
      { status: "signed_out" },
    );
  });

  it("does not show signed out while restoring", () => {
    expect(
      mobileAuthReducer({ status: "signed_out" }, { type: "restore_started" }),
    ).toEqual({ status: "booting" });
  });
});
