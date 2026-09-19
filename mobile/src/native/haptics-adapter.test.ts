import { NotificationType } from "@capacitor/haptics";
import { describe, expect, it, vi } from "vitest";

import { createCapacitorHapticsAdapter } from "./haptics-adapter";

function createPlugin() {
  return {
    notification: vi.fn(async () => undefined),
    selectionChanged: vi.fn(async () => undefined),
    selectionEnd: vi.fn(async () => undefined),
    selectionStart: vi.fn(async () => undefined),
  };
}

describe("Capacitor Haptics adapter", () => {
  it("is available only in the native runtime with the plugin registered", () => {
    const plugin = createPlugin();

    expect(
      createCapacitorHapticsAdapter({
        isNativeRuntime: () => true,
        isPluginAvailable: () => true,
        plugin,
      }).isAvailable(),
    ).toBe(true);
    expect(
      createCapacitorHapticsAdapter({
        isNativeRuntime: () => false,
        isPluginAvailable: () => true,
        plugin,
      }).isAvailable(),
    ).toBe(false);
    expect(
      createCapacitorHapticsAdapter({
        isNativeRuntime: () => true,
        isPluginAvailable: () => false,
        plugin,
      }).isAvailable(),
    ).toBe(false);
  });

  it("maps the three semantic operations to the official plugin", async () => {
    const plugin = createPlugin();
    const adapter = createCapacitorHapticsAdapter({
      isNativeRuntime: () => true,
      isPluginAvailable: () => true,
      plugin,
    });

    await adapter.selection();
    await adapter.success();
    await adapter.warning();

    expect(plugin.selectionStart).toHaveBeenCalledOnce();
    expect(plugin.selectionChanged).toHaveBeenCalledOnce();
    expect(plugin.selectionEnd).toHaveBeenCalledOnce();
    expect(plugin.notification).toHaveBeenNthCalledWith(1, {
      type: NotificationType.Success,
    });
    expect(plugin.notification).toHaveBeenNthCalledWith(2, {
      type: NotificationType.Warning,
    });
  });

  it("is a safe noop when the plugin is unavailable", async () => {
    const plugin = createPlugin();
    const adapter = createCapacitorHapticsAdapter({
      isNativeRuntime: () => true,
      isPluginAvailable: () => false,
      plugin,
    });

    await expect(adapter.selection()).resolves.toBeUndefined();
    await expect(adapter.success()).resolves.toBeUndefined();
    await expect(adapter.warning()).resolves.toBeUndefined();
    expect(plugin.selectionStart).not.toHaveBeenCalled();
    expect(plugin.notification).not.toHaveBeenCalled();
  });

  it("does not turn optional feedback failures into product errors", async () => {
    const plugin = createPlugin();
    plugin.selectionChanged.mockRejectedValueOnce(new Error("unavailable"));
    plugin.notification.mockRejectedValue(new Error("unavailable"));
    const adapter = createCapacitorHapticsAdapter({
      isNativeRuntime: () => true,
      isPluginAvailable: () => true,
      plugin,
    });

    await expect(adapter.selection()).resolves.toBeUndefined();
    await expect(adapter.success()).resolves.toBeUndefined();
    await expect(adapter.warning()).resolves.toBeUndefined();
    expect(plugin.selectionEnd).toHaveBeenCalledOnce();
  });
});

