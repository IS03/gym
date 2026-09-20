import { describe, expect, it } from "vitest";

import { selectMobileRootSurface } from "./root-state";

describe("mobile root surface", () => {
  it("mounts the product shell only for a confirmed authenticated session", () => {
    expect(selectMobileRootSurface("authenticated")).toBe("product");
    expect(selectMobileRootSurface("booting")).toBe("auth");
    expect(selectMobileRootSurface("signed_out")).toBe("auth");
    expect(selectMobileRootSurface("signing_in")).toBe("auth");
    expect(selectMobileRootSurface("auth_unavailable")).toBe("auth");
  });
});
