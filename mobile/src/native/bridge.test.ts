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

function createHapticsMock() {
  return {
    isAvailable: vi.fn(() => false),
    selection: vi.fn(async () => undefined),
    success: vi.fn(async () => undefined),
    warning: vi.fn(async () => undefined),
  };
}

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
      haptics: createHapticsMock(),
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
      haptics: createHapticsMock(),
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
      haptics: createHapticsMock(),
    });

    expect(JSON.parse(JSON.stringify(await bridge.info()))).toEqual(iosInfo);
  });

  it("delegates haptics only when the capability is available", async () => {
    const haptics = createHapticsMock();
    const bridge = createNativeCapabilities({
      isCapacitorRuntime: () => true,
      readCapacitorInfo: async () => ({
        ...iosInfo,
        capabilities: {
          ...iosInfo.capabilities,
          haptics: "available",
        },
      }),
      readWebInfo: () => iosInfo,
      haptics,
    });

    expect(await bridge.haptics.available()).toBe(true);
    await bridge.haptics.selection();
    await bridge.haptics.success();
    await bridge.haptics.warning();

    expect(haptics.selection).toHaveBeenCalledOnce();
    expect(haptics.success).toHaveBeenCalledOnce();
    expect(haptics.warning).toHaveBeenCalledOnce();
  });
});
