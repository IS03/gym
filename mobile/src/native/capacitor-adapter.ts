import type { AppInfo } from "@capacitor/app";

import {
  NATIVE_BRIDGE_VERSION,
  type NativeCapabilityStates,
  type NativeInfo,
} from "./types";
import { unavailableCapabilities } from "./web-adapter";

export type CapacitorAppInfoReader = () => Promise<AppInfo>;

export async function createCapacitorNativeInfo(
  getAppInfo: CapacitorAppInfoReader,
  capabilityStates: NativeCapabilityStates = unavailableCapabilities(),
): Promise<NativeInfo> {
  let appVersion: string | null = null;
  let buildNumber: string | null = null;

  try {
    const appInfo = await getAppInfo();
    appVersion = appInfo.version || null;
    buildNumber = appInfo.build || null;
  } catch {
    // Version metadata is diagnostic. Its absence must not break the product.
  }

  return {
    platform: "ios",
    runtime: "capacitor",
    appVersion,
    buildNumber,
    bridgeVersion: NATIVE_BRIDGE_VERSION,
    capabilities: { ...capabilityStates },
  };
}
