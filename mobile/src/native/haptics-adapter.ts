import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";

import { isCapacitorRuntime } from "./runtime";

export type HapticsPlugin = Pick<
  typeof Haptics,
  "notification" | "selectionChanged" | "selectionEnd" | "selectionStart"
>;

export type NativeHapticsAdapter = {
  isAvailable: () => boolean;
  selection: () => Promise<void>;
  success: () => Promise<void>;
  warning: () => Promise<void>;
};

type HapticsAdapterDependencies = {
  isNativeRuntime: () => boolean;
  isPluginAvailable: () => boolean;
  plugin: HapticsPlugin;
};

const defaultDependencies: HapticsAdapterDependencies = {
  isNativeRuntime: isCapacitorRuntime,
  isPluginAvailable: () => Capacitor.isPluginAvailable("Haptics"),
  plugin: Haptics,
};

export function createCapacitorHapticsAdapter(
  dependencies: HapticsAdapterDependencies = defaultDependencies,
): NativeHapticsAdapter {
  function isAvailable(): boolean {
    return (
      dependencies.isNativeRuntime() && dependencies.isPluginAvailable()
    );
  }

  async function safelyInvoke(operation: () => Promise<void>): Promise<void> {
    if (!isAvailable()) {
      return;
    }

    try {
      await operation();
    } catch {
      // Haptics are optional feedback. Their absence must not fail the action.
    }
  }

  return {
    isAvailable,
    selection: () =>
      safelyInvoke(async () => {
        try {
          await dependencies.plugin.selectionStart();
          await dependencies.plugin.selectionChanged();
        } finally {
          await dependencies.plugin.selectionEnd();
        }
      }),
    success: () =>
      safelyInvoke(() =>
        dependencies.plugin.notification({ type: NotificationType.Success }),
      ),
    warning: () =>
      safelyInvoke(() =>
        dependencies.plugin.notification({ type: NotificationType.Warning }),
      ),
  };
}

