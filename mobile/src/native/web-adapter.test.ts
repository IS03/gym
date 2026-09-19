import { describe, expect, it } from "vitest";

import { createWebNativeInfo } from "./web-adapter";

describe("web native adapter", () => {
  it("distinguishes a normal browser from a PWA without user-agent checks", () => {
    expect(
      createWebNativeInfo({
        displayModeStandalone: false,
        iosStandalone: false,
      }).platform,
    ).toBe("web");

    expect(
      createWebNativeInfo({
        displayModeStandalone: true,
        iosStandalone: false,
      }).platform,
    ).toBe("pwa");

    expect(
      createWebNativeInfo({
        displayModeStandalone: false,
        iosStandalone: true,
      }).platform,
    ).toBe("pwa");
  });

  it("returns browser metadata and safe unavailable capabilities", () => {
    const info = createWebNativeInfo({
      displayModeStandalone: false,
      iosStandalone: false,
    });

    expect(info).toMatchObject({
      runtime: "browser",
      appVersion: null,
      buildNumber: null,
      bridgeVersion: 1,
    });
    expect(Object.values(info.capabilities)).toEqual([
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
  });
});
