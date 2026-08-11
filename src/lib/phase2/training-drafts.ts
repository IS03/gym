import type { SessionMetadataInput, WorkoutExercisePayload } from "./types";
import {
  validateSessionMetadata,
  validateWorkoutExercisePayload,
} from "./training-validation";

export const TRAINING_DRAFT_VERSION = 2 as const;
const DRAFT_EVENT = "gym-training-draft-change";

export type WorkoutExerciseDraft = {
  version: typeof TRAINING_DRAFT_VERSION;
  sessionExerciseId: string;
  serverUpdatedAt: string;
  savedAt: string;
  payload: WorkoutExercisePayload;
};

export type SessionMetadataDraft = {
  version: typeof TRAINING_DRAFT_VERSION;
  sessionId: string;
  savedAt: string;
  metadata: SessionMetadataInput;
};

export function workoutDraftKey(sessionId: string, sessionExerciseId: string) {
  return `gym:workout-draft:v${TRAINING_DRAFT_VERSION}:${sessionId}:${sessionExerciseId}`;
}

export function sessionMetadataDraftKey(sessionId: string) {
  return `gym:session-meta:v${TRAINING_DRAFT_VERSION}:${sessionId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWorkoutExerciseDraft(
  raw: string | null,
  sessionExerciseId: string,
): WorkoutExerciseDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== TRAINING_DRAFT_VERSION ||
      value.sessionExerciseId !== sessionExerciseId ||
      typeof value.serverUpdatedAt !== "string" ||
      typeof value.savedAt !== "string" ||
      !isRecord(value.payload)
    ) {
      return null;
    }
    const draft = value as WorkoutExerciseDraft;
    validateWorkoutExercisePayload(draft.payload);
    return draft;
  } catch {
    return null;
  }
}

export function parseSessionMetadataDraft(
  raw: string | null,
  sessionId: string,
): SessionMetadataDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== TRAINING_DRAFT_VERSION ||
      value.sessionId !== sessionId ||
      typeof value.savedAt !== "string" ||
      !isRecord(value.metadata)
    ) {
      return null;
    }
    const metadata = { ...value.metadata };
    // Un borrador de una versión anterior puede contener este campo ya retirado.
    delete metadata.abs_completed;
    const draft = {
      ...value,
      metadata,
    } as SessionMetadataDraft;
    validateSessionMetadata(draft.metadata);
    return draft;
  } catch {
    return null;
  }
}

export function getDraftSnapshot(keys: readonly string[]): string {
  if (typeof window === "undefined") return "{}";
  const snapshot: Record<string, string | null> = {};
  for (const key of keys) {
    try {
      snapshot[key] = window.localStorage.getItem(key);
    } catch {
      snapshot[key] = null;
    }
  }
  return JSON.stringify(snapshot);
}

export function getServerDraftSnapshot(): string {
  return "{}";
}

export function subscribeDraftStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const notify = () => onStoreChange();
  window.addEventListener("storage", notify);
  window.addEventListener(DRAFT_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(DRAFT_EVENT, notify);
  };
}

function emitDraftChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }
}

export function writeDraft(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emitDraftChange();
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
  emitDraftChange();
}
