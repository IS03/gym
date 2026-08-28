export type DailyActivityDraft = {
  steps: string;
  waterL: string;
  mateL: string;
};

export type DailyActivityAutosaveState =
  | { phase: "idle" | "scheduled" | "saving" | "saved"; error: null }
  | { phase: "error"; error: string };

type Options = {
  debounceMs: number;
  initial: DailyActivityDraft;
  save: (draft: DailyActivityDraft) => Promise<void>;
  onStateChange?: (state: DailyActivityAutosaveState) => void;
};

function same(left: DailyActivityDraft, right: DailyActivityDraft) {
  return (
    left.steps === right.steps &&
    left.waterL === right.waterL &&
    left.mateL === right.mateL
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

/**
 * Cola de una sola escritura para actividad diaria. Los cambios rápidos se
 * agrupan y una revisión nueva espera a la anterior, por lo que una respuesta
 * vieja nunca puede persistir después del último valor local.
 */
export class DailyActivityAutosaveQueue {
  private latest: DailyActivityDraft;
  private confirmed: DailyActivityDraft;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<boolean> | null = null;
  private disposed = false;

  constructor(private readonly options: Options) {
    this.latest = { ...options.initial };
    this.confirmed = { ...options.initial };
  }

  change(next: DailyActivityDraft) {
    if (this.disposed || same(this.latest, next)) return;
    this.latest = { ...next };
    if (same(this.latest, this.confirmed)) {
      this.clearTimer();
      this.options.onStateChange?.({ phase: "idle", error: null });
      return;
    }
    if (this.inFlight) {
      this.options.onStateChange?.({ phase: "scheduled", error: null });
      return;
    }
    this.schedule();
  }

  async flush() {
    this.clearTimer();
    return this.drain();
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
  }

  private clearTimer() {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    this.clearTimer();
    this.options.onStateChange?.({ phase: "scheduled", error: null });
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, this.options.debounceMs);
  }

  private async drain(): Promise<boolean> {
    if (this.disposed) return same(this.latest, this.confirmed);
    this.clearTimer();

    if (this.inFlight) {
      await this.inFlight;
      if (same(this.latest, this.confirmed)) return true;
      return this.drain();
    }
    if (same(this.latest, this.confirmed)) return true;

    const saving = { ...this.latest };
    this.options.onStateChange?.({ phase: "saving", error: null });
    const request = (async () => {
      try {
        await this.options.save(saving);
        this.confirmed = saving;
        this.options.onStateChange?.({
          phase: same(this.latest, saving) ? "saved" : "scheduled",
          error: null,
        });
        return true;
      } catch (error) {
        this.options.onStateChange?.({ phase: "error", error: errorMessage(error) });
        return false;
      }
    })();

    this.inFlight = request;
    const succeeded = await request;
    if (this.inFlight === request) this.inFlight = null;

    if (succeeded && !this.disposed && !same(this.latest, this.confirmed)) {
      return this.drain();
    }
    return succeeded && same(this.latest, this.confirmed);
  }
}
