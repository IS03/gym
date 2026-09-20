import { describe, expect, it, vi } from "vitest";

import { runSingleMutation } from "./mutation-guard";

describe("mobile mutation guard", () => {
  it("blocks a second tap while the first write is pending", async () => {
    let release: (() => void) | undefined;
    const action = vi.fn(
      () => new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const pending = { current: false };

    const first = runSingleMutation(pending, action);
    const second = runSingleMutation(pending, action);

    await expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toBe(true);
    expect(pending.current).toBe(false);
  });

  it("releases the guard after a failure so an explicit retry is possible", async () => {
    const pending = { current: false };
    await expect(
      runSingleMutation(pending, async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
    expect(pending.current).toBe(false);
  });
});
