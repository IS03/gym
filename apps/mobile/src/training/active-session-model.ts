import { canonicalSessionExercisePayload, parseSessionExercisePayload, parseSessionFinishMetadata, type QuickSessionHistoryDto, type SessionFinishMetadata, type SessionExerciseDto, type SessionExercisePayloadDto, type SessionSetDto } from '@/api/active-session';

export type SessionExerciseDraft = Omit<SessionExercisePayloadDto, 'sets' | 'isCompleted'> & {
  sets: (Omit<SessionSetDto, 'actualReps' | 'actualWeightKg'> & { localId: string; actualReps: string; actualWeightKg: string })[];
};
export type StoredExerciseDraft = {
  version: 1;
  sessionId: string;
  sessionExerciseId: string;
  serverUpdatedAt: string;
  basePayload: SessionExercisePayloadDto;
  draft: SessionExerciseDraft;
  writeId: string;
  attemptPayload?: SessionExercisePayloadDto;
};
export type RestDeadline = { exerciseId: string; exerciseName: string; endAt: number };

let rowSequence = 0;
const rowId = () => `set-${Date.now().toString(36)}-${++rowSequence}`;
export function exerciseDraft(payload: SessionExercisePayloadDto): SessionExerciseDraft {
  return { decision: payload.decision, decisionNote: payload.decisionNote, applyToRoutine: payload.applyToRoutine, notes: payload.notes,
    sets: payload.sets.map(set => ({ ...set, localId: rowId(), actualReps: set.actualReps === null ? '' : String(set.actualReps),
      actualWeightKg: set.actualWeightKg === null ? '' : String(set.actualWeightKg).replace('.', ',') })) };
}
function numeric(value: string, label: string, max: number, integer: boolean): number | null {
  const text = value.trim();
  if (!text) return null;
  // Keep unfinished comma/dot input on screen; canonical value can still save.
  if (!/^\d+(?:[.,]\d*)?$/.test(text)) throw new Error(`${label} no es válido.`);
  const number = Number(text.replace(',', '.'));
  if (!Number.isFinite(number) || number < 0 || number > max || (integer && !Number.isInteger(number))) throw new Error(`${label} debe estar entre 0 y ${max}${integer ? ' y ser entero' : ''}.`);
  if (!integer && Math.abs(number * 100 - Math.round(number * 100)) > 1e-8) throw new Error(`${label} admite hasta dos decimales.`);
  return number;
}
export function exercisePayload(draft: SessionExerciseDraft): SessionExercisePayloadDto {
  if (!draft.sets.length || draft.sets.length > 50) throw new Error('El ejercicio admite de 1 a 50 series.');
  const sets = draft.sets.map((set, index) => {
    const actualReps = numeric(set.actualReps, `Reps de serie ${index + 1}`, 1000, true);
    if (set.isCompleted && actualReps === null) throw new Error(`Completá las reps de la serie ${index + 1}.`);
    return { setNumber: index + 1, targetReps: set.targetReps, targetWeightKg: set.targetWeightKg, targetRir: set.targetRir,
      isCompleted: set.isCompleted, notes: set.notes, actualReps, actualWeightKg: numeric(set.actualWeightKg, `Peso de serie ${index + 1}`, 9999.99, false) };
  });
  if (draft.decision === 'custom' && !draft.decisionNote.trim()) throw new Error('El recordatorio anterior necesita una nota.');
  return canonicalSessionExercisePayload({ ...draft, sets, isCompleted: sets.some(set => set.isCompleted) });
}
export function sameExercisePayload(a: SessionExercisePayloadDto, b: SessionExercisePayloadDto): boolean {
  const ordered = (p: SessionExercisePayloadDto) => [p.isCompleted, p.decision, p.decision === 'custom' ? p.decisionNote.trim() : '', p.applyToRoutine, p.notes,
    p.sets.map(s => [s.setNumber, s.targetReps, s.targetWeightKg, s.targetRir, s.actualReps, s.actualWeightKg, s.isCompleted, s.notes || null])];
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
}
export function draftIsDirty(draft: SessionExerciseDraft, server: SessionExercisePayloadDto): boolean {
  try { return !sameExercisePayload(exercisePayload(draft), server); } catch { return true; }
}
export function appendSessionSet(draft: SessionExerciseDraft): SessionExerciseDraft {
  if (draft.sets.length >= 50) return draft;
  const last = draft.sets.at(-1);
  return { ...draft, sets: [...draft.sets, { localId: rowId(), setNumber: draft.sets.length + 1,
    targetReps: last?.targetReps ?? null, targetWeightKg: last?.targetWeightKg ?? null, targetRir: last?.targetRir ?? null,
    actualReps: last?.actualReps ?? '', actualWeightKg: last?.actualWeightKg ?? '', isCompleted: false, notes: null }] };
}
export function removeSessionSet(draft: SessionExerciseDraft, index: number): SessionExerciseDraft {
  if (draft.sets.length <= 1 || index < 0 || index >= draft.sets.length) return draft;
  return { ...draft, sets: draft.sets.filter((_, i) => i !== index).map((set, i) => ({ ...set, setNumber: i + 1 })) };
}
export function moveSessionSet(draft: SessionExerciseDraft, from: number, to: number): SessionExerciseDraft {
  if (from === to || from < 0 || to < 0 || from >= draft.sets.length || to >= draft.sets.length) return draft;
  const sets = [...draft.sets];
  const [moved] = sets.splice(from, 1); sets.splice(to, 0, moved);
  return { ...draft, sets: sets.map((set, index) => ({ ...set, setNumber: index + 1 })) };
}
export function resetSessionSet(draft: SessionExerciseDraft, index: number): SessionExerciseDraft {
  if (index < 0 || index >= draft.sets.length) return draft;
  return { ...draft, sets: draft.sets.map((set, position) => position === index
    ? { ...set, actualReps: '', actualWeightKg: '', isCompleted: false, notes: null } : set) };
}
export function setProgress(draft: SessionExerciseDraft) {
  const completed = draft.sets.filter(set => set.isCompleted).length;
  return { completed, total: draft.sets.length, complete: draft.sets.length > 0 && completed === draft.sets.length };
}
export function nextReminder(exercise: SessionExerciseDto): string | null {
  if (exercise.nextAdjustmentSnapshot === 'increase_weight') return 'Subir peso';
  if (exercise.nextAdjustmentSnapshot === 'increase_reps') return 'Subir repeticiones';
  return exercise.nextAdjustmentSnapshot === 'custom' ? exercise.nextAdjustmentNoteSnapshot?.trim() || null : null;
}
export function restSeconds(exercise: SessionExerciseDto): number | null {
  const valid = (value: number | null) => value !== null && Number.isFinite(value) && value > 0 ? value : null;
  return valid(exercise.restMaxSecondsSnapshot) ?? valid(exercise.restMinSecondsSnapshot);
}
export function restoreRestDeadline(value: unknown, exerciseIds: ReadonlySet<string>, now = Date.now()): RestDeadline | null {
  if (!value || typeof value !== 'object') return null;
  const timer = value as RestDeadline;
  return typeof timer.exerciseId === 'string' && exerciseIds.has(timer.exerciseId) && typeof timer.exerciseName === 'string' &&
    typeof timer.endAt === 'number' && Number.isFinite(timer.endAt) && timer.endAt > now - 60000 ? timer : null;
}
export function restRemaining(timer: RestDeadline, now = Date.now()): number { return Math.max(0, Math.ceil((timer.endAt - now) / 1000)); }
export function durationLabel(milliseconds: number): string {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  return minutes === 0 ? '<1 min' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
export function compactActual(value: number | null): string { return value === null ? '—' : String(value).replace('.', ','); }
export function historySetLabel(set: SessionSetDto): string {
  const parts = [set.actualReps === null ? null : `${set.actualReps} reps`, set.actualWeightKg === null ? null : `${compactActual(set.actualWeightKg)} kg`,
    set.targetRir === null ? null : `RIR obj ${set.targetRir}`].filter(Boolean);
  return parts.join(' · ') || 'Sin carga ni reps registradas';
}
export function historyLoadLabel(set: SessionSetDto): string {
  if (set.actualWeightKg !== null && set.actualReps !== null) return `${compactActual(set.actualWeightKg)} kg × ${set.actualReps}`;
  if (set.actualWeightKg !== null) return `${compactActual(set.actualWeightKg)} kg`;
  if (set.actualReps !== null) return `${set.actualReps} reps`;
  return 'Sin carga ni reps registradas';
}
export function compactHistoryDate(date: string): string {
  const [year, month, day] = date.split('-');
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}
export function quickSessions(rows: readonly QuickSessionHistoryDto[]) { return rows.slice(0, 6); }
export function parseStoredExerciseDraft(value: unknown, sessionId: string, id: string): StoredExerciseDraft | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as StoredExerciseDraft;
  if (record.version !== 1 || record.sessionId !== sessionId || record.sessionExerciseId !== id || typeof record.serverUpdatedAt !== 'string' ||
    typeof record.writeId !== 'string' || !parseSessionExercisePayload(record.basePayload)) return null;
  if (record.attemptPayload && !parseSessionExercisePayload(record.attemptPayload)) return null;
  const draft = record.draft;
  if (!draft || typeof draft.notes !== 'string' || typeof draft.decisionNote !== 'string' || typeof draft.applyToRoutine !== 'boolean' ||
    !['maintain', 'increase_weight', 'increase_reps', 'custom'].includes(draft.decision) || !Array.isArray(draft.sets) || !draft.sets.length || draft.sets.length > 50) return null;
  // Preserve invalid/partial numeric text, but validate immutable targets and flags.
  if (!draft.sets.every((set, index) => typeof set.actualReps === 'string' && typeof set.actualWeightKg === 'string' &&
    !!parseSessionExercisePayload({ isCompleted: set.isCompleted, decision: 'maintain', decisionNote: '', applyToRoutine: false, notes: '',
      sets: [{ setNumber: 1, targetReps: set.targetReps, targetWeightKg: set.targetWeightKg, targetRir: set.targetRir,
        isCompleted: set.isCompleted, notes: set.notes, actualReps: null, actualWeightKg: null }] }) && set.setNumber === index + 1)) return null;
  // Older journals had no row identity. Adopt one locally without changing the API payload.
  const sets = draft.sets.map(set => ({ ...set, localId: typeof set.localId === 'string' && set.localId ? set.localId : rowId() }));
  if (new Set(sets.map(set => set.localId)).size !== sets.length) return null;
  return { ...record, draft: { ...draft, sets } };
}

// M3.4-2 — session summary entered before finishing (Web parity: energy and
// performance 1–5, pain 0–10, notes). Unanswered stays null; 0 pain is real.
export type SessionSummaryDraft = { energyLevel: number | null; performanceLevel: number | null; painLevel: number | null; notes: string };
export const emptySessionSummary: SessionSummaryDraft = { energyLevel: null, performanceLevel: null, painLevel: null, notes: '' };
export const SUMMARY_SCALES = { energyLevel: [1, 5], performanceLevel: [1, 5], painLevel: [0, 10] } as const;
export function finishMetadata(draft: SessionSummaryDraft): SessionFinishMetadata {
  // Storage keeps '' as NULL; canonicalize so a retry sends the identical payload.
  return { energyLevel: draft.energyLevel, performanceLevel: draft.performanceLevel, painLevel: draft.painLevel,
    notes: draft.notes === '' ? null : draft.notes };
}
export function summaryIsValid(draft: SessionSummaryDraft): boolean {
  return parseSessionFinishMetadata(finishMetadata(draft)) !== undefined;
}
export function parseStoredSummary(value: unknown): SessionSummaryDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.notes !== 'string') return null;
  const parsed = parseSessionFinishMetadata({ energyLevel: raw.energyLevel, performanceLevel: raw.performanceLevel, painLevel: raw.painLevel, notes: raw.notes });
  return parsed ? { energyLevel: parsed.energyLevel, performanceLevel: parsed.performanceLevel, painLevel: parsed.painLevel, notes: raw.notes } : null;
}
/** Shared kg/reps text parser (same limits and messages as the active session). */
export const parseDraftNumber = numeric;
