export type ExerciseAutosavePhase = "scheduled" | "saving" | "saved" | "error";

export type ExerciseAutosaveErrorCategory =
  | "transient"
  | "conflict"
  | "timeout"
  | "session_closed"
  | "validation"
  | "removed";

export type ExerciseAutosaveState = {
  phase: ExerciseAutosavePhase;
  error: string | null;
  errorCategory: ExerciseAutosaveErrorCategory | null;
};

export type ExerciseAutosaveServerState<Payload> =
  | { status: "active"; payload: Payload; updatedAt: string }
  | { status: "session_closed" }
  | { status: "removed" };

export class ExerciseAutosaveError extends Error {
  constructor(
    public readonly category: ExerciseAutosaveErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = "ExerciseAutosaveError";
  }
}

type DrainOutcome = "success" | "retry" | "error";

type AutosaveEntry<Payload> = {
  latestPayload: Payload;
  serverPayload: Payload;
  serverVersion: string;
  revision: number;
  syncedRevision: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<boolean> | null;
  paused: boolean;
  error: string | null;
  errorCategory: ExerciseAutosaveErrorCategory | null;
};

type ExerciseAutosaveOptions<Payload> = {
  debounceMs: number;
  equals: (left: Payload, right: Payload) => boolean;
  save: (input: {
    exerciseId: string;
    payload: Payload;
    expectedUpdatedAt: string;
  }) => Promise<{ updatedAt: string }>;
  loadServerState: (
    exerciseId: string,
  ) => Promise<ExerciseAutosaveServerState<Payload>>;
  onStateChange?: (exerciseId: string, state: ExerciseAutosaveState) => void;
  onServerState?: (
    exerciseId: string,
    state: ExerciseAutosaveServerState<Payload>,
  ) => void;
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

function errorDetails(error: unknown): {
  message: string;
  category: ExerciseAutosaveErrorCategory;
} {
  if (error instanceof ExerciseAutosaveError) {
    return { message: error.message, category: error.category };
  }
  return {
    message: error instanceof Error ? error.message : "No se pudo guardar.",
    category: "transient",
  };
}

function unavailableMessage(status: "session_closed" | "removed") {
  return status === "session_closed"
    ? "La sesión ya fue finalizada. Actualizá para ver el estado guardado."
    : "Este ejercicio ya no está en la sesión. Actualizá para continuar.";
}

/**
 * Serializa guardados por ejercicio y permite ejercicios diferentes en paralelo.
 * Los conflictos se reconcilian contra el servidor antes de volver a escribir, y
 * una revisión confirmada nunca marca como guardada una revisión local más nueva.
 */
export class ExerciseAutosaveQueue<Payload> {
  private readonly entries = new Map<string, AutosaveEntry<Payload>>();
  private disposed = false;
  private fenced = false;

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
        existing.serverPayload = input.serverPayload;
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
      serverPayload: input.serverPayload,
      serverVersion: input.serverVersion,
      revision: hasLocalChanges ? 1 : 0,
      syncedRevision: 0,
      timer: null,
      inFlight: null,
      paused: false,
      error: null,
      errorCategory: null,
    };
    this.entries.set(input.exerciseId, entry);
    if (hasLocalChanges) this.schedule(input.exerciseId, entry);
  }

  change(exerciseId: string, payload: Payload, options?: { immediate?: boolean }) {
    const entry = this.requireEntry(exerciseId);
    if (entry.paused || this.disposed || this.fenced) return;
    if (this.options.equals(entry.latestPayload, payload)) return;

    entry.latestPayload = payload;
    entry.revision += 1;

    // A real conflict must be reconciled explicitly. Keep accepting the local
    // draft, but never turn a later keystroke into an implicit overwrite.
    if (
      entry.errorCategory === "conflict" ||
      entry.errorCategory === "session_closed" ||
      entry.errorCategory === "removed"
    ) {
      return;
    }

    entry.error = null;
    entry.errorCategory = null;
    if (entry.inFlight) return;
    if (options?.immediate) {
      void this.drain(exerciseId, true);
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
    if (entry.errorCategory === "conflict") {
      return this.retryConflict(exerciseId, entry);
    }
    if (
      entry.errorCategory === "session_closed" ||
      entry.errorCategory === "removed"
    ) {
      return false;
    }
    return this.drain(exerciseId, true);
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

  /** Stops accepting edits, drains the exact pending revisions, and stays fenced. */
  async fenceAndFlushAll(exerciseIds: readonly string[]) {
    this.fenced = true;
    for (const entry of this.entries.values()) this.clearTimer(entry);
    return this.flushAll(exerciseIds);
  }

  releaseFence() {
    if (this.disposed) return;
    this.fenced = false;
  }

  getErrorCategory(exerciseId: string) {
    return this.entries.get(exerciseId)?.errorCategory ?? null;
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
    if (!entry || this.disposed || this.fenced) return;
    entry.paused = false;
    if (
      entry.revision !== entry.syncedRevision &&
      entry.errorCategory === null
    ) {
      this.schedule(exerciseId, entry);
    }
  }

  async discardLocal(
    exerciseId: string,
  ): Promise<ExerciseAutosaveServerState<Payload>> {
    const entry = this.requireEntry(exerciseId);
    await this.pauseAndWait(exerciseId);
    try {
      const state = await this.options.loadServerState(exerciseId);
      this.options.onServerState?.(exerciseId, state);
      if (state.status !== "active") {
        this.setError(
          exerciseId,
          entry,
          unavailableMessage(state.status),
          state.status,
        );
        return state;
      }

      entry.serverPayload = state.payload;
      entry.serverVersion = state.updatedAt;
      entry.latestPayload = state.payload;
      entry.syncedRevision = entry.revision;
      entry.error = null;
      entry.errorCategory = null;
      this.options.onStateChange?.(exerciseId, {
        phase: "saved",
        error: null,
        errorCategory: null,
      });
      return state;
    } catch (error) {
      const details = errorDetails(error);
      this.setError(exerciseId, entry, details.message, details.category);
      throw error;
    } finally {
      entry.paused = false;
    }
  }

  async remove(exerciseId: string) {
    await this.pauseAndWait(exerciseId);
    this.entries.delete(exerciseId);
  }

  activate() {
    this.disposed = false;
    this.fenced = false;
    for (const [exerciseId, entry] of this.entries) {
      entry.paused = false;
      if (
        entry.revision !== entry.syncedRevision &&
        entry.inFlight === null &&
        entry.errorCategory === null
      ) {
        this.schedule(exerciseId, entry);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.fenced = true;
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
    if (entry.paused || this.disposed || this.fenced || entry.inFlight) return;
    this.clearTimer(entry);
    this.options.onStateChange?.(exerciseId, {
      phase: "scheduled",
      error: null,
      errorCategory: null,
    });
    entry.timer = setTimeout(() => {
      entry.timer = null;
      void this.drain(exerciseId, true);
    }, this.options.debounceMs);
  }

  private setError(
    exerciseId: string,
    entry: AutosaveEntry<Payload>,
    message: string,
    category: ExerciseAutosaveErrorCategory,
  ) {
    entry.error = message;
    entry.errorCategory = category;
    this.options.onStateChange?.(exerciseId, {
      phase: "error",
      error: message,
      errorCategory: category,
    });
  }

  private confirmSaved(
    exerciseId: string,
    entry: AutosaveEntry<Payload>,
    savedRevision: number,
    savedPayload: Payload,
    updatedAt: string,
  ) {
    entry.serverPayload = savedPayload;
    entry.serverVersion = updatedAt;
    entry.syncedRevision = savedRevision;
    entry.error = null;
    entry.errorCategory = null;
    const hasNewerChanges = entry.revision > savedRevision;
    this.options.onSaved?.(exerciseId, {
      savedPayload,
      latestPayload: entry.latestPayload,
      updatedAt,
      hasNewerChanges,
    });
    this.options.onStateChange?.(exerciseId, {
      phase: hasNewerChanges ? "scheduled" : "saved",
      error: null,
      errorCategory: null,
    });
  }

  private async reconcileConflict(
    exerciseId: string,
    entry: AutosaveEntry<Payload>,
    savedRevision: number,
    savedPayload: Payload,
    allowRetry: boolean,
  ): Promise<DrainOutcome> {
    let state: ExerciseAutosaveServerState<Payload>;
    try {
      state = await this.options.loadServerState(exerciseId);
    } catch {
      this.setError(
        exerciseId,
        entry,
        "No pudimos comprobar la versión guardada. Reintentá cuando tengas conexión.",
        "conflict",
      );
      return "error";
    }

    this.options.onServerState?.(exerciseId, state);
    if (state.status !== "active") {
      this.setError(
        exerciseId,
        entry,
        unavailableMessage(state.status),
        state.status,
      );
      return "error";
    }

    if (this.options.equals(state.payload, savedPayload)) {
      this.confirmSaved(
        exerciseId,
        entry,
        savedRevision,
        state.payload,
        state.updatedAt,
      );
      return "success";
    }

    if (this.options.equals(state.payload, entry.serverPayload) && allowRetry) {
      entry.serverPayload = state.payload;
      entry.serverVersion = state.updatedAt;
      entry.error = null;
      entry.errorCategory = null;
      return "retry";
    }

    this.setError(
      exerciseId,
      entry,
      "Este ejercicio cambió en otra pestaña. Tus cambios siguen guardados localmente.",
      "conflict",
    );
    return "error";
  }

  private async retryConflict(
    exerciseId: string,
    entry: AutosaveEntry<Payload>,
  ): Promise<boolean> {
    const outcome = await this.reconcileConflict(
      exerciseId,
      entry,
      entry.revision,
      entry.latestPayload,
      true,
    );
    if (outcome === "retry") return this.drain(exerciseId, false);
    return outcome === "success" && entry.revision === entry.syncedRevision;
  }

  private async drain(
    exerciseId: string,
    allowConflictRecovery: boolean,
  ): Promise<boolean> {
    const entry = this.entries.get(exerciseId);
    if (!entry) return true;
    if (entry.paused || this.disposed) {
      return entry.revision === entry.syncedRevision;
    }
    this.clearTimer(entry);

    if (entry.inFlight) return entry.inFlight;
    if (entry.revision === entry.syncedRevision) return true;

    const request = this.runDrain(exerciseId, entry, allowConflictRecovery);
    entry.inFlight = request;
    const succeeded = await request;
    if (entry.inFlight === request) entry.inFlight = null;
    return succeeded;
  }

  private async runDrain(
    exerciseId: string,
    entry: AutosaveEntry<Payload>,
    allowConflictRecovery: boolean,
  ): Promise<boolean> {
    let canRecoverConflict = allowConflictRecovery;

    while (
      !this.disposed &&
      !entry.paused &&
      entry.revision !== entry.syncedRevision
    ) {
      const savedRevision = entry.revision;
      const savedPayload = entry.latestPayload;
      const expectedUpdatedAt = entry.serverVersion;
      this.options.onStateChange?.(exerciseId, {
        phase: "saving",
        error: null,
        errorCategory: null,
      });

      try {
        const result = await this.options.save({
          exerciseId,
          payload: savedPayload,
          expectedUpdatedAt,
        });
        this.confirmSaved(
          exerciseId,
          entry,
          savedRevision,
          savedPayload,
          result.updatedAt,
        );
        canRecoverConflict = true;
      } catch (error) {
        const details = errorDetails(error);
        if (details.category !== "conflict") {
          this.setError(exerciseId, entry, details.message, details.category);
          return false;
        }

        const outcome = await this.reconcileConflict(
          exerciseId,
          entry,
          savedRevision,
          savedPayload,
          canRecoverConflict,
        );
        if (outcome === "error") return false;
        if (outcome === "retry") canRecoverConflict = false;
      }
    }

    return entry.revision === entry.syncedRevision;
  }
}
