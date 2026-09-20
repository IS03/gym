import { App } from "@capacitor/app";

import { isCapacitorRuntime } from "./runtime";

export async function subscribeToAppForeground(
  onForeground: () => void,
): Promise<() => void> {
  if (!isCapacitorRuntime()) return () => undefined;

  const handle = await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) onForeground();
  });
  return () => {
    void handle.remove();
  };
}
