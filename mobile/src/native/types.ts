export const NATIVE_BRIDGE_VERSION = 1 as const;

export const NATIVE_CAPABILITY_NAMES = [
  "haptics",
  "notifications",
  "health",
  "camera",
  "photos",
] as const;

export type NativePlatform = "web" | "pwa" | "ios";
export type NativeRuntime = "browser" | "capacitor";
export type NativeCapabilityName = (typeof NATIVE_CAPABILITY_NAMES)[number];
export type NativeCapabilityState =
  | "available"
  | "unavailable"
  | "permission_required"
  | "denied";

export type NativeCapabilityStates = Record<
  NativeCapabilityName,
  NativeCapabilityState
>;

export type NativeInfo = {
  platform: NativePlatform;
  runtime: NativeRuntime;
  appVersion: string | null;
  buildNumber: string | null;
  bridgeVersion: typeof NATIVE_BRIDGE_VERSION;
  capabilities: NativeCapabilityStates;
};

export type HapticsCapability = {
  available: () => Promise<boolean>;
  selection: () => Promise<void>;
  success: () => Promise<void>;
  warning: () => Promise<void>;
};

export type NativeCapabilities = {
  info: () => Promise<NativeInfo>;
  capability: (name: string) => Promise<NativeCapabilityState>;
  haptics: HapticsCapability;
};

export type MobileUpdatePolicy =
  | "supported"
  | "update_recommended"
  | "update_required";
