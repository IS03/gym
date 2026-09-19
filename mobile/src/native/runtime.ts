import { Capacitor } from "@capacitor/core";

export function isCapacitorRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}
