import { describe, expect, it, vi } from "vitest";
import { DailyActivityAutosaveQueue, type DailyActivityDraft } from "./activity-autosave";

const initial: DailyActivityDraft = { steps: "", waterL: "", mateL: "" };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("DailyActivityAutosaveQueue", () => {
  it("debounces steps, water and mate into one request", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const queue = new DailyActivityAutosaveQueue({ debounceMs: 650, initial, save });

    queue.change({ steps: "1", waterL: "", mateL: "" });
    queue.change({ steps: "10", waterL: "1", mateL: "" });
    queue.change({ steps: "100", waterL: "1.5", mateL: "0" });
    await vi.advanceTimersByTimeAsync(649);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({ steps: "100", waterL: "1.5", mateL: "0" });
    vi.useRealTimers();
  });

  it("serializes requests so the latest change wins", async () => {
    const first = deferred();
    const second = deferred();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const queue = new DailyActivityAutosaveQueue({ debounceMs: 650, initial, save });

    queue.change({ ...initial, steps: "10" });
    void queue.flush();
    queue.change({ ...initial, steps: "100" });
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith({ ...initial, steps: "100" });
    second.resolve();
    await expect(queue.flush()).resolves.toBe(true);
  });

  it("flushes a pending edit immediately on blur", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => undefined);
    const queue = new DailyActivityAutosaveQueue({ debounceMs: 650, initial, save });
    queue.change({ ...initial, waterL: "2" });

    await queue.flush();
    expect(save).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("shows an error without retry loops and retries after a later change", async () => {
    const states: string[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(undefined);
    const queue = new DailyActivityAutosaveQueue({
      debounceMs: 650,
      initial,
      save,
      onStateChange: (state) => states.push(state.phase),
    });
    queue.change({ ...initial, mateL: "0.5" });
    await expect(queue.flush()).resolves.toBe(false);
    expect(save).toHaveBeenCalledOnce();
    expect(states.at(-1)).toBe("error");

    queue.change({ ...initial, mateL: "0.6" });
    await expect(queue.flush()).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
