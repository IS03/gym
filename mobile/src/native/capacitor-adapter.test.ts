import { describe, expect, it } from "vitest";

import { createCapacitorNativeInfo } from "./capacitor-adapter";
import { unavailableCapabilities } from "./web-adapter";

describe("Capacitor native adapter", () => {
  it("reads the native app version and build number", async () => {
    const info = await createCapacitorNativeInfo(async () => ({
      name: "OWNLEVEL",
      id: "fit.ownlevel.app",
      version: "1.2.3",
      build: "42",
    }));

    expect(info).toEqual({
      platform: "ios",
      runtime: "capacitor",
      appVersion: "1.2.3",
      buildNumber: "42",
      bridgeVersion: 1,
      capabilities: unavailableCapabilities(),
    });
  });

  it("degrades missing native metadata without throwing", async () => {
    const info = await createCapacitorNativeInfo(async () => {
      throw new Error("native metadata unavailable");
    });

    expect(info.appVersion).toBeNull();
    expect(info.buildNumber).toBeNull();
    expect(info.runtime).toBe("capacitor");
  });
});
