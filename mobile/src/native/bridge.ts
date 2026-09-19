import { App } from "@capacitor/app";

import { createCapacitorNativeInfo } from "./capacitor-adapter";
import {
  createCapacitorHapticsAdapter,
  type NativeHapticsAdapter,
} from "./haptics-adapter";
import { isCapacitorRuntime } from "./runtime";
import {
  type NativeCapabilities,
  type NativeCapabilityState,
  type NativeInfo,
} from "./types";
import { createWebNativeInfo, readWebRuntimeEnvironment } from "./web-adapter";

export type NativeBridgeDependencies = {
  isCapacitorRuntime: () => boolean;
  readCapacitorInfo: () => Promise<NativeInfo>;
  readWebInfo: () => NativeInfo;
  haptics: NativeHapticsAdapter;
};

const capacitorHaptics = createCapacitorHapticsAdapter();

const defaultDependencies: NativeBridgeDependencies = {
  isCapacitorRuntime,
  readCapacitorInfo: () =>
    createCapacitorNativeInfo(() => App.getInfo(), {
      haptics: capacitorHaptics.isAvailable() ? "available" : "unavailable",
      notifications: "unavailable",
      health: "unavailable",
      camera: "unavailable",
      photos: "unavailable",
    }),
  readWebInfo: () => createWebNativeInfo(readWebRuntimeEnvironment()),
  haptics: capacitorHaptics,
};

export function createNativeCapabilities(
  dependencies: NativeBridgeDependencies = defaultDependencies,
): NativeCapabilities {
  let infoPromise: Promise<NativeInfo> | null = null;

  function info(): Promise<NativeInfo> {
    if (!infoPromise) {
      infoPromise = dependencies.isCapacitorRuntime()
        ? dependencies.readCapacitorInfo()
        : Promise.resolve(dependencies.readWebInfo());
    }

    return infoPromise;
  }

  async function capability(name: string): Promise<NativeCapabilityState> {
    const nativeInfo = await info();
    return name in nativeInfo.capabilities
      ? nativeInfo.capabilities[name as keyof typeof nativeInfo.capabilities]
      : "unavailable";
  }

  async function invokeHaptics(
    operation: keyof Pick<
      NativeHapticsAdapter,
      "selection" | "success" | "warning"
    >,
  ): Promise<void> {
    if ((await capability("haptics")) !== "available") {
      return;
    }

    await dependencies.haptics[operation]();
  }

  return {
    info,
    capability,
    haptics: {
      available: async () => (await capability("haptics")) === "available",
      selection: () => invokeHaptics("selection"),
      success: () => invokeHaptics("success"),
      warning: () => invokeHaptics("warning"),
    },
  };
}

export const native = createNativeCapabilities();
