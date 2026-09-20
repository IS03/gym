import { describe, expect, it } from "vitest";

import { parseProductDeepLink } from "./product-deep-link";

describe("native product deep links", () => {
  it("maps only the explicit product boundary to known routes", () => {
    expect(parseProductDeepLink("ownlevel://app/train")).toBe("/train");
    expect(parseProductDeepLink("ownlevel://app/today")).toBe("/today");
    expect(parseProductDeepLink("ownlevel://app/unknown")).toBeNull();
  });

  it("never consumes the M3 Auth callback", () => {
    expect(
      parseProductDeepLink("ownlevel://auth/callback?code=sensitive"),
    ).toBeNull();
  });

  it("rejects malformed or extended destinations", () => {
    expect(parseProductDeepLink("ownlevel://app/train?userId=other")).toBeNull();
    expect(parseProductDeepLink("https://ownlevel.fit/train")).toBeNull();
    expect(parseProductDeepLink("not a url")).toBeNull();
  });
});
