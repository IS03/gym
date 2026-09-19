import { App } from "@capacitor/app";

import { createCapacitorNativeInfo } from "./capacitor-adapter";
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
};

const defaultDependencies: NativeBridgeDependencies = {
  isCapacitorRuntime,
  readCapacitorInfo: () => createCapacitorNativeInfo(() => App.getInfo()),
  readWebInfo: () => createWebNativeInfo(readWebRuntimeEnvironment()),
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

  async function noop(): Promise<void> {
    // Capability absence is a supported fallback, not a product error.
  }

  return {
    info,
    capability,
    haptics: {
      available: async () => (await capability("haptics")) === "available",
      selection: noop,
      success: noop,
      warning: noop,
    },
  };
}

export const native = createNativeCapabilities();
