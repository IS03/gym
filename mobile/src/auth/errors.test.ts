import { describe, expect, it } from "vitest";

import { isConfirmedInvalidSession } from "./errors";

describe("native auth errors", () => {
  it("recognizes a confirmed invalid session", () => {
    expect(
      isConfirmedInvalidSession({ code: "refresh_token_not_found" }),
    ).toBe(true);
    expect(
      isConfirmedInvalidSession({ name: "AuthSessionMissingError" }),
    ).toBe(true);
  });

  it("does not confuse transient infrastructure errors with logout", () => {
    expect(isConfirmedInvalidSession({ message: "Gateway Timeout" })).toBe(
      false,
    );
    expect(isConfirmedInvalidSession({ message: "fetch failed" })).toBe(false);
    expect(
      isConfirmedInvalidSession({ status: 401, code: "PGRST303" }),
    ).toBe(false);
  });
});
