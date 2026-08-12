export type ExerciseAutosavePhase = "scheduled" | "saving" | "saved" | "error";

export type ExerciseAutosaveState = {
  phase: ExerciseAutosavePhase;
  error: string | null;
};

type AutosaveEntry<Payload> = {
  latestPayload: Payload;
  serverVersion: string;
  revision: number;
  syncedRevision: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<boolean> | null;
  paused: boolean;
  error: string | null;
};

type ExerciseAutosaveOptions<Payload> = {
  debounceMs: number;
  equals: (left: Payload, right: Payload) => boolean;
  save: (input: {
    exerciseId: string;
    payload: Payload;
    expectedUpdatedAt: string;
  }) => Promise<{ updatedAt: string }>;
  onStateChange?: (exerciseId: string, state: ExerciseAutosaveState) => void;
  onSaved?: (
    exerciseId: string,
    result: {
      savedPayload: Payload;
      latestPayload: Payload;
      updatedAt: string;
      hasNewerChanges: boolean;
    },
  ) => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

/**
 * Serializa guardados por ejercicio, pero permite que ejercicios diferentes
 * sincronicen en paralelo. Una revisión confirmada nunca marca como guardada
 * una revisión local más nueva.
 */
export class ExerciseAutosaveQueue<Payload> {
  private readonly entries = new Map<string, AutosaveEntry<Payload>>();
  private disposed = false;

  constructor(private readonly options: ExerciseAutosaveOptions<Payload>) {}

  register(input: {
    exerciseId: string;
    serverVersion: string;
    serverPayload: Payload;
    localPayload?: Payload;
  }) {
    const existing = this.entries.get(input.exerciseId);
    if (existing) {
      if (
        existing.inFlight === null &&
        existing.revision === existing.syncedRevision &&
        existing.serverVersion !== input.serverVersion
      ) {
        existing.serverVersion = input.serverVersion;
        existing.latestPayload = input.localPayload ?? input.serverPayload;
        if (!this.options.equals(existing.latestPayload, input.serverPayload)) {
          existing.revision += 1;
          this.schedule(input.exerciseId, existing);
        }
      }
      return;
    }

    const latestPayload = input.localPayload ?? input.serverPayload;
    const hasLocalChanges = !this.options.equals(latestPayload, input.serverPayload);
    const entry: AutosaveEntry<Payload> = {
      latestPayload,
      serverVersion: input.serverVersion,
      revision: hasLocalChanges ? 1 : 0,
      syncedRevision: 0,
      timer: null,
      inFlight: null,
      paused: false,
      error: null,
    };
    this.entries.set(input.exerciseId, entry);
    if (hasLocalChanges) this.schedule(input.exerciseId, entry);
  }

  change(exerciseId: string, payload: Payload, options?: { immediate?: boolean }) {
    const entry = this.requireEntry(exerciseId);
    if (entry.paused || this.disposed) return;
    if (this.options.equals(entry.latestPayload, payload)) return;

    entry.latestPayload = payload;
    entry.revision += 1;
    entry.error = null;

    if (entry.inFlight) return;
    if (options?.immediate) {
      void this.drain(exerciseId);
      return;
    }
    this.schedule(exerciseId, entry);
  }

  retry(exerciseId: string) {
    return this.flush(exerciseId);
  }

  async flush(exerciseId: string): Promise<boolean> {
    const entry = this.entries.get(exerciseId);
    if (!entry) return true;
    this.clearTimer(entry);
    return this.drain(exerciseId);
  }

  async flushAll(exerciseIds: readonly string[]) {
    const results = await Promise.all(
      exerciseIds.map(async (exerciseId) => ({
        exerciseId,
        ok: await this.flush(exerciseId),
      })),
    );
    return results.filter((result) => !result.ok).map((result) => result.exerciseId);
  }

  async pauseAndWait(exerciseId: string) {
    const entry = this.entries.get(exerciseId);
    if (!entry) return;
    entry.paused = true;
    this.clearTimer(entry);
    if (entry.inFlight) await entry.inFlight;
  }

  resume(exerciseId: string) {
    const entry = this.entries.get(exerciseId);
    if (!entry || this.disposed) return;
    entry.paused = false;
    if (entry.revision !== entry.syncedRevision) this.schedule(exerciseId, entry);
  }

  async discardLocal(exerciseId: string, serverPayload: Payload) {
    const entry = this.entries.get(exerciseId);
    if (!entry) return;
    await this.pauseAndWait(exerciseId);
    entry.latestPayload = serverPayload;
    entry.revision = entry.syncedRevision;
    entry.error = null;
    entry.paused = false;
    this.options.onStateChange?.(exerciseId, { phase: "saved", error: null });
  }

  async remove(exerciseId: string) {
    await this.pauseAndWait(exerciseId);
    this.entries.delete(exerciseId);
  }

  activate() {
    this.disposed = false;
    for (const [exerciseId, entry] of this.entries) {
      entry.paused = false;
      if (entry.revision !== entry.syncedRevision && entry.inFlight === null) {
        this.schedule(exerciseId, entry);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      entry.paused = true;
      this.clearTimer(entry);
    }
  }

  private requireEntry(exerciseId: string) {
    const entry = this.entries.get(exerciseId);
    if (!entry) throw new Error(`Autosave no registrado para ${exerciseId}.`);
    return entry;
  }

  private clearTimer(entry: AutosaveEntry<Payload>) {
    if (entry.timer === null) return;
    clearTimeout(entry.timer);
    entry.timer = null;
  }

  private schedule(exerciseId: string, entry: AutosaveEntry<Payload>) {
    if (entry.paused || this.disposed || entry.inFlight) return;
    this.clearTimer(entry);
    this.options.onStateChange?.(exerciseId, { phase: "scheduled", error: null });
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void this.drain(exerciseId);
    }, this.options.debounceMs);
  }

  private async drain(exerciseId: string): Promise<boolean> {
    const entry = this.entries.get(exerciseId);
    if (!entry) return true;
    if (entry.paused || this.disposed) {
      return entry.revision === entry.syncedRevision;
    }
    this.clearTimer(entry);

    if (entry.inFlight) {
      await entry.inFlight;
      if (entry.error) return false;
      return entry.revision === entry.syncedRevision
        ? true
        : this.drain(exerciseId);
    }
    if (entry.revision === entry.syncedRevision) return true;

    const savedRevision = entry.revision;
    const savedPayload = entry.latestPayload;
    const expectedUpdatedAt = entry.serverVersion;
    this.options.onStateChange?.(exerciseId, { phase: "saving", error: null });

    const request = (async () => {
      try {
        const result = await this.options.save({
          exerciseId,
          payload: savedPayload,
          expectedUpdatedAt,
        });
        entry.serverVersion = result.updatedAt;
        entry.syncedRevision = savedRevision;
        entry.error = null;
        const hasNewerChanges = entry.revision > savedRevision;
        this.options.onSaved?.(exerciseId, {
          savedPayload,
          latestPayload: entry.latestPayload,
          updatedAt: result.updatedAt,
          hasNewerChanges,
        });
        this.options.onStateChange?.(exerciseId, {
          phase: hasNewerChanges ? "scheduled" : "saved",
          error: null,
        });
        return true;
      } catch (error) {
        entry.error = errorMessage(error);
        this.options.onStateChange?.(exerciseId, {
          phase: "error",
          error: entry.error,
        });
        return false;
      }
    })();

    entry.inFlight = request;
    const succeeded = await request;
    if (entry.inFlight === request) entry.inFlight = null;

    if (
      succeeded &&
      !this.disposed &&
      !entry.paused &&
      entry.revision !== entry.syncedRevision
    ) {
      return this.drain(exerciseId);
    }
    return succeeded && entry.revision === entry.syncedRevision;
  }
}
