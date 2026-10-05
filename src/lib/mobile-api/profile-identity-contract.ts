// M8 Profile identity contract (display name), shared by the Mobile API adapter and Expo (pure; no server imports).
// Mirrors Web settings/profile-actions.ts: trimmed text, blank = null, no length or character rules.

export type ProfileIdentity = { displayName: string | null; version: string };
export type DisplayNameIntent = { displayName: string | null; expectedVersion: string; idempotencyKey: string };
export type DisplayNameReceipt = { status: "confirmed"; displayName: string | null; version: string };
export const DISPLAY_NAME_CONFLICTS = ["PROFILE_CHANGED", "IDEMPOTENCY_KEY_REUSED"] as const;

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(n => n in v);
const isVersion = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const isKey = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(v);

/** Web semantics: trim, and a blank name means "no name" (null). */
export function normalizeDisplayName(input: string): string | null {
  return input.trim() || null;
}
const isNormalized = (v: unknown): v is string | null => v === null || (typeof v === "string" && v !== "" && v === v.trim());

/** Server truth is shown as stored; only the write path enforces normalization. */
export function parseProfileIdentity(v: unknown): ProfileIdentity | undefined {
  if (!record(v) || !exactKeys(v, ["displayName", "version"]) || (v.displayName !== null && typeof v.displayName !== "string") || !isVersion(v.version)) return;
  return { displayName: v.displayName, version: v.version };
}
export function parseDisplayNameIntent(v: unknown): DisplayNameIntent | undefined {
  if (!record(v) || !exactKeys(v, ["displayName", "expectedVersion", "idempotencyKey"]) || !isNormalized(v.displayName)
    || !isVersion(v.expectedVersion) || !isKey(v.idempotencyKey)) return;
  return { displayName: v.displayName, expectedVersion: v.expectedVersion, idempotencyKey: v.idempotencyKey };
}
export function parseDisplayNameReceipt(v: unknown): DisplayNameReceipt | undefined {
  if (!record(v) || !exactKeys(v, ["status", "displayName", "version"]) || v.status !== "confirmed" || !isNormalized(v.displayName) || !isVersion(v.version)) return;
  return { status: "confirmed", displayName: v.displayName, version: v.version };
}
