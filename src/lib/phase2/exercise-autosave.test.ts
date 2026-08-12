import { describe, expect, it, vi } from "vitest";
import { ExerciseAutosaveQueue } from "./exercise-autosave";

type Payload = { weight: number };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function queue(
  save: (input: {
    exerciseId: string;
    payload: Payload;
    expectedUpdatedAt: string;
  }) => Promise<{ updatedAt: string }>,
  onSaved?: ConstructorParameters<typeof ExerciseAutosaveQueue<Payload>>[0]["onSaved"],
) {
  return new ExerciseAutosaveQueue<Payload>({
    debounceMs: 800,
    equals: (left, right) => left.weight === right.weight,
    save,
    onSaved,
  });
}

describe("ExerciseAutosaveQueue", () => {
  it("debounces rapid edits into one request", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => ({ updatedAt: "v2" }));
    const autosave = queue(save);
    autosave.register({
      exerciseId: "curl",
      serverVersion: "v1",
      serverPayload: { weight: 0 },
    });

    autosave.change("curl", { weight: 5 });
    await vi.advanceTimersByTimeAsync(400);
    autosave.change("curl", { weight: 52 });
    autosave.change("curl", { weight: 52.5 });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      exerciseId: "curl",
      payload: { weight: 52.5 },
      expectedUpdatedAt: "v1",
    });
    vi.useRealTimers();
  });

  it("allows different exercises to save concurrently", async () => {
    const jalon = deferred<{ updatedAt: string }>();
    const remo = deferred<{ updatedAt: string }>();
    const save = vi.fn((input: { exerciseId: string }) =>
      input.exerciseId === "jalon" ? jalon.promise : remo.promise,
    );
    const autosave = queue(save);
    autosave.register({ exerciseId: "jalon", serverVersion: "j1", serverPayload: { weight: 48 } });
    autosave.register({ exerciseId: "remo", serverVersion: "r1", serverPayload: { weight: 20 } });

    autosave.change("jalon", { weight: 52 }, { immediate: true });
    autosave.change("remo", { weight: 25 }, { immediate: true });
    expect(save).toHaveBeenCalledTimes(2);

    jalon.resolve({ updatedAt: "j2" });
    remo.resolve({ updatedAt: "r2" });
    await Promise.all([autosave.flush("jalon"), autosave.flush("remo")]);
  });

  it("serializes a newer edit behind the in-flight save with the new server version", async () => {
    const first = deferred<{ updatedAt: string }>();
    const second = deferred<{ updatedAt: string }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const onSaved = vi.fn();
    const autosave = queue(save, onSaved);
    autosave.register({
      exerciseId: "jalon",
      serverVersion: "v1",
      serverPayload: { weight: 48 },
    });

    autosave.change("jalon", { weight: 52 }, { immediate: true });
    autosave.change("jalon", { weight: 55 });
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve({ updatedAt: "v2" });
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(onSaved).toHaveBeenNthCalledWith(1, "jalon", {
      savedPayload: { weight: 52 },
      latestPayload: { weight: 55 },
      updatedAt: "v2",
      hasNewerChanges: true,
    });
    expect(save).toHaveBeenLastCalledWith({
      exerciseId: "jalon",
      payload: { weight: 55 },
      expectedUpdatedAt: "v2",
    });

    second.resolve({ updatedAt: "v3" });
    await expect(autosave.flush("jalon")).resolves.toBe(true);
  });

  it("keeps a failed edit pending and succeeds on manual retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ updatedAt: "v2" });
    const autosave = queue(save);
    autosave.register({
      exerciseId: "curl",
      serverVersion: "v1",
      serverPayload: { weight: 25 },
    });
    autosave.change("curl", { weight: 30 }, { immediate: true });

    await expect(autosave.flush("curl")).resolves.toBe(false);
    await expect(autosave.retry("curl")).resolves.toBe(true);
    expect(save).toHaveBeenLastCalledWith({
      exerciseId: "curl",
      payload: { weight: 30 },
      expectedUpdatedAt: "v1",
    });
  });

  it("does not launch a queued follow-up after an exercise is paused for deletion", async () => {
    const first = deferred<{ updatedAt: string }>();
    const save = vi.fn(() => first.promise);
    const autosave = queue(save);
    autosave.register({
      exerciseId: "remo",
      serverVersion: "v1",
      serverPayload: { weight: 20 },
    });
    autosave.change("remo", { weight: 25 }, { immediate: true });
    autosave.change("remo", { weight: 30 });

    const paused = autosave.pauseAndWait("remo");
    first.resolve({ updatedAt: "v2" });
    await paused;
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("reports every exercise that could not be flushed before finalization", async () => {
    const save = vi.fn(async ({ exerciseId }: { exerciseId: string }) => {
      if (exerciseId === "curl") throw new Error("Sin conexión");
      return { updatedAt: `${exerciseId}-v2` };
    });
    const autosave = queue(save);
    autosave.register({ exerciseId: "jalon", serverVersion: "j1", serverPayload: { weight: 48 } });
    autosave.register({ exerciseId: "curl", serverVersion: "c1", serverPayload: { weight: 25 } });
    autosave.change("jalon", { weight: 52 });
    autosave.change("curl", { weight: 30 });

    await expect(autosave.flushAll(["jalon", "curl"])).resolves.toEqual(["curl"]);
  });
});
