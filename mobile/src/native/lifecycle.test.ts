import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addListener: vi.fn(),
  isCapacitorRuntime: vi.fn(() => true),
  remove: vi.fn(),
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener },
}));

vi.mock("./runtime", () => ({
  isCapacitorRuntime: mocks.isCapacitorRuntime,
}));

import { subscribeToAppForeground } from "./lifecycle";

describe("native app foreground lifecycle", () => {
  beforeEach(() => {
    mocks.addListener.mockReset();
    mocks.isCapacitorRuntime.mockReset();
    mocks.isCapacitorRuntime.mockReturnValue(true);
    mocks.remove.mockReset();
  });

  it("refreshes only when the native app becomes active and removes its listener", async () => {
    const captured: {
      listener?: (state: { isActive: boolean }) => void;
    } = {};
    mocks.addListener.mockImplementation(async (_event, callback) => {
      captured.listener = callback;
      return { remove: mocks.remove };
    });
    const onForeground = vi.fn();

    const unsubscribe = await subscribeToAppForeground(onForeground);
    const listener = captured.listener;
    if (!listener) throw new Error("Expected appStateChange listener");
    listener({ isActive: false });
    listener({ isActive: true });
    expect(onForeground).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });

  it("is a safe noop outside Capacitor", async () => {
    mocks.isCapacitorRuntime.mockReturnValue(false);
    const unsubscribe = await subscribeToAppForeground(vi.fn());
    unsubscribe();
    expect(mocks.addListener).not.toHaveBeenCalled();
  });
});
