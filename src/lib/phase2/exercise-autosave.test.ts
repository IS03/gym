import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExerciseAutosaveError,
  ExerciseAutosaveQueue,
  type ExerciseAutosaveServerState,
} from "./exercise-autosave";

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
  options?: {
    loadServerState?: (
      exerciseId: string,
    ) => Promise<ExerciseAutosaveServerState<Payload>>;
    onSaved?: ConstructorParameters<
      typeof ExerciseAutosaveQueue<Payload>
    >[0]["onSaved"];
    onStateChange?: ConstructorParameters<
      typeof ExerciseAutosaveQueue<Payload>
    >[0]["onStateChange"];
    onServerState?: ConstructorParameters<
      typeof ExerciseAutosaveQueue<Payload>
    >[0]["onServerState"];
  },
) {
  return new ExerciseAutosaveQueue<Payload>({
    debounceMs: 800,
    equals: (left, right) => left.weight === right.weight,
    save,
    loadServerState:
      options?.loadServerState ??
      (async () => ({ status: "active", payload: { weight: 0 }, updatedAt: "v1" })),
    onSaved: options?.onSaved,
    onStateChange: options?.onStateChange,
    onServerState: options?.onServerState,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

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
  });

  it("serializes one exercise and uses the new server version for a newer revision", async () => {
    const first = deferred<{ updatedAt: string }>();
    const second = deferred<{ updatedAt: string }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const onSaved = vi.fn();
    const autosave = queue(save, { onSaved });
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

  it("allows two different exercises to save concurrently", async () => {
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

  it("keeps a transient failure pending and succeeds on retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ExerciseAutosaveError("transient", "Sin conexión"))
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

  it("rebases a version-only conflict once instead of repeating the stale version", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ExerciseAutosaveError("conflict", "Versión vieja"))
      .mockResolvedValueOnce({ updatedAt: "v3" });
    const loadServerState = vi.fn(async () => ({
      status: "active" as const,
      payload: { weight: 25 },
      updatedAt: "v2",
    }));
    const autosave = queue(save, { loadServerState });
    autosave.register({
      exerciseId: "curl",
      serverVersion: "v1",
      serverPayload: { weight: 25 },
    });
    autosave.change("curl", { weight: 30 }, { immediate: true });

    await expect(autosave.flush("curl")).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls.map(([input]) => input.expectedUpdatedAt)).toEqual(["v1", "v2"]);
  });

  it("does not overwrite a semantically different remote conflict", async () => {
    const save = vi.fn().mockRejectedValue(
      new ExerciseAutosaveError("conflict", "Versión vieja"),
    );
    const loadServerState = vi.fn(async () => ({
      status: "active" as const,
      payload: { weight: 60 },
      updatedAt: "v2",
    }));
    const onStateChange = vi.fn();
    const autosave = queue(save, { loadServerState, onStateChange });
    autosave.register({
      exerciseId: "curl",
      serverVersion: "v1",
      serverPayload: { weight: 25 },
    });
    autosave.change("curl", { weight: 30 }, { immediate: true });

    await expect(autosave.flush("curl")).resolves.toBe(false);
    await expect(autosave.retry("curl")).resolves.toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenLastCalledWith("curl", {
      phase: "error",
      error: "Este ejercicio cambió en otra pestaña. Tus cambios siguen guardados localmente.",
      errorCategory: "conflict",
    });
  });

  it("recognizes a committed save whose response was lost", async () => {
    const save = vi.fn().mockRejectedValueOnce(
      new ExerciseAutosaveError("conflict", "Respuesta perdida"),
    );
    const loadServerState = vi.fn(async () => ({
      status: "active" as const,
      payload: { weight: 30 },
      updatedAt: "v2",
    }));
    const autosave = queue(save, { loadServerState });
    autosave.register({
      exerciseId: "curl",
      serverVersion: "v1",
      serverPayload: { weight: 25 },
    });
    autosave.change("curl", { weight: 30 }, { immediate: true });

    await expect(autosave.flush("curl")).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("leaves a lock timeout recoverable", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ExerciseAutosaveError("timeout", "El guardado demoró demasiado."),
      )
      .mockResolvedValueOnce({ updatedAt: "v2" });
    const autosave = queue(save);
    autosave.register({ exerciseId: "remo", serverVersion: "v1", serverPayload: { weight: 20 } });
    autosave.change("remo", { weight: 25 }, { immediate: true });

    await expect(autosave.flush("remo")).resolves.toBe(false);
    expect(autosave.getErrorCategory("remo")).toBe("timeout");
    await expect(autosave.retry("remo")).resolves.toBe(true);
  });

  it("flushAll provides the safe online retry path", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ExerciseAutosaveError("transient", "Offline"))
      .mockResolvedValueOnce({ updatedAt: "v2" });
    const autosave = queue(save);
    autosave.register({ exerciseId: "curl", serverVersion: "v1", serverPayload: { weight: 25 } });
    autosave.change("curl", { weight: 30 }, { immediate: true });
    await expect(autosave.flushAll(["curl"])).resolves.toEqual(["curl"]);
    await expect(autosave.flushAll(["curl"])).resolves.toEqual([]);
  });

  it("discard reloads the current server payload instead of the mount snapshot", async () => {
    const save = vi.fn().mockRejectedValueOnce(
      new ExerciseAutosaveError("transient", "Offline"),
    );
    const onServerState = vi.fn();
    const loadServerState = vi.fn(async () => ({
      status: "active" as const,
      payload: { weight: 35 },
      updatedAt: "v4",
    }));
    const autosave = queue(save, { loadServerState, onServerState });
    autosave.register({ exerciseId: "curl", serverVersion: "v1", serverPayload: { weight: 25 } });
    autosave.change("curl", { weight: 30 }, { immediate: true });
    await expect(autosave.flush("curl")).resolves.toBe(false);

    await expect(autosave.discardLocal("curl")).resolves.toEqual({
      status: "active",
      payload: { weight: 35 },
      updatedAt: "v4",
    });
    expect(onServerState).toHaveBeenCalledWith("curl", {
      status: "active",
      payload: { weight: 35 },
      updatedAt: "v4",
    });
  });

  it("remove waits for in-flight work and never launches its queued revision", async () => {
    const first = deferred<{ updatedAt: string }>();
    const save = vi.fn(() => first.promise);
    const autosave = queue(save);
    autosave.register({ exerciseId: "remo", serverVersion: "v1", serverPayload: { weight: 20 } });
    autosave.change("remo", { weight: 25 }, { immediate: true });
    autosave.change("remo", { weight: 30 });

    const removed = autosave.remove("remo");
    first.resolve({ updatedAt: "v2" });
    await removed;
    expect(save).toHaveBeenCalledTimes(1);
    await expect(autosave.flush("remo")).resolves.toBe(true);
  });

  it("dispose never launches a follow-up save", async () => {
    const first = deferred<{ updatedAt: string }>();
    const save = vi.fn(() => first.promise);
    const autosave = queue(save);
    autosave.register({ exerciseId: "remo", serverVersion: "v1", serverPayload: { weight: 20 } });
    autosave.change("remo", { weight: 25 }, { immediate: true });
    autosave.change("remo", { weight: 30 });
    autosave.dispose();

    first.resolve({ updatedAt: "v2" });
    await expect(autosave.flush("remo")).resolves.toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("finalization fences edits before draining and starts no later save", async () => {
    const first = deferred<{ updatedAt: string }>();
    const save = vi.fn(() => first.promise);
    const autosave = queue(save);
    autosave.register({ exerciseId: "remo", serverVersion: "v1", serverPayload: { weight: 20 } });
    autosave.change("remo", { weight: 25 });

    const draining = autosave.fenceAndFlushAll(["remo"]);
    autosave.change("remo", { weight: 30 }, { immediate: true });
    first.resolve({ updatedAt: "v2" });
    await expect(draining).resolves.toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      exerciseId: "remo",
      payload: { weight: 25 },
      expectedUpdatedAt: "v1",
    });
  });
});
