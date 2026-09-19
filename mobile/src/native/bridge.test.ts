import { describe, expect, it, vi } from "vitest";

import { createNativeCapabilities } from "./bridge";
import type { NativeInfo } from "./types";
import { createWebNativeInfo, unavailableCapabilities } from "./web-adapter";

const iosInfo: NativeInfo = {
  platform: "ios",
  runtime: "capacitor",
  appVersion: "1.0",
  buildNumber: "1",
  bridgeVersion: 1,
  capabilities: unavailableCapabilities(),
};

describe("OWNLEVEL native capability bridge", () => {
  it("selects the iOS adapter only for the Capacitor runtime", async () => {
    const readCapacitorInfo = vi.fn().mockResolvedValue(iosInfo);
    const readWebInfo = vi.fn(() =>
      createWebNativeInfo({
        displayModeStandalone: false,
        iosStandalone: false,
      }),
    );
    const bridge = createNativeCapabilities({
      isCapacitorRuntime: () => true,
      readCapacitorInfo,
      readWebInfo,
    });

    expect(await bridge.info()).toEqual(iosInfo);
    expect(readCapacitorInfo).toHaveBeenCalledOnce();
    expect(readWebInfo).not.toHaveBeenCalled();
  });

  it("caches stable info and safely handles unknown capabilities", async () => {
    const readWebInfo = vi.fn(() =>
      createWebNativeInfo({
        displayModeStandalone: false,
        iosStandalone: false,
      }),
    );
    const bridge = createNativeCapabilities({
      isCapacitorRuntime: () => false,
      readCapacitorInfo: vi.fn().mockResolvedValue(iosInfo),
      readWebInfo,
    });

    expect(await bridge.capability("future-capability")).toBe("unavailable");
    expect(await bridge.haptics.available()).toBe(false);
    await expect(bridge.haptics.selection()).resolves.toBeUndefined();
    await expect(bridge.haptics.success()).resolves.toBeUndefined();
    await expect(bridge.haptics.warning()).resolves.toBeUndefined();
    expect(readWebInfo).toHaveBeenCalledOnce();
  });

  it("returns a serializable, privacy-bounded contract", async () => {
    const bridge = createNativeCapabilities({
      isCapacitorRuntime: () => true,
      readCapacitorInfo: async () => iosInfo,
      readWebInfo: () => iosInfo,
    });

    expect(JSON.parse(JSON.stringify(await bridge.info()))).toEqual(iosInfo);
  });
});
