import {
  NATIVE_BRIDGE_VERSION,
  type NativeCapabilityStates,
  type NativeInfo,
} from "./types";

export type WebRuntimeEnvironment = {
  displayModeStandalone: boolean;
  iosStandalone: boolean;
};

export function unavailableCapabilities(): NativeCapabilityStates {
  return {
    haptics: "unavailable",
    notifications: "unavailable",
    health: "unavailable",
    camera: "unavailable",
    photos: "unavailable",
  };
}
export function readWebRuntimeEnvironment(): WebRuntimeEnvironment {
  return {
    displayModeStandalone:
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches,
    iosStandalone:
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

export function createWebNativeInfo(
  environment: WebRuntimeEnvironment,
): NativeInfo {
  return {
    platform:
      environment.displayModeStandalone || environment.iosStandalone
        ? "pwa"
        : "web",
    runtime: "browser",
    appVersion: null,
    buildNumber: null,
    bridgeVersion: NATIVE_BRIDGE_VERSION,
    capabilities: unavailableCapabilities(),
  };
}
