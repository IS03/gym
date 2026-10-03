import type { SessionDetailDto } from '@/api/active-session';
import type { SessionCorrectionInput, TrainingHistoryMark, TrainingHistorySession } from '@/api/training-history';
import { formatDuration, formatTimeRange } from '@/home/format';
import { parseDraftNumber } from './active-session-model';

// M3.4-3 — presentation for history/day/exercise history and the correction draft.
// Only formats server truth: missing stays missing, never 0.
const decimal = (value: number) => String(Math.round(value * 10) / 10).replace('.', ',');
export function markLabel(mark: TrainingHistoryMark | null): string {
  if (!mark) return '—';
  if (mark.weightKg !== null && mark.reps !== null) return `${decimal(mark.weightKg)} kg × ${decimal(mark.reps)}`;
  if (mark.weightKg !== null) return `${decimal(mark.weightKg)} kg`;
  if (mark.reps !== null) return `${decimal(mark.reps)} reps`;
  return '—';
}
export function plural(value: number, singular: string, pluralForm = `${singular}s`) { return `${value} ${value === 1 ? singular : pluralForm}`; }
export function markMetadata(completedSets: number, rirValues: readonly number[]): string {
  return [plural(completedSets, 'serie'), rirValues.length ? `RIR ${rirValues.join(' / ')}` : null].filter(Boolean).join(' · ');
}
const volumeFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export function volumeLabel(volumeKg: number | null): string | null {
  return volumeKg === null || !Number.isFinite(volumeKg) || volumeKg < 0 ? null : `${volumeFormatter.format(volumeKg)} kg`;
}
function noonUtc(date: string) { const [year, month, day] = date.split('-').map(Number); return new Date(Date.UTC(year, month - 1, day, 12)); }
export function dayHeading(date: string): string {
  const label = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(noonUtc(date));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(noonUtc(date)).replace('.', '');
}
export function sessionTiming(session: Pick<TrainingHistorySession, 'startedAt' | 'endedAt' | 'durationMilliseconds'>): string {
  return [formatTimeRange(session.startedAt, session.endedAt), formatDuration(session.durationMilliseconds)].filter(Boolean).join(' · ');
}
export function sessionTotals(session: Pick<TrainingHistorySession, 'exercisesCompleted' | 'completedSets' | 'volumeKg'>): string {
  const volume = volumeLabel(session.volumeKg);
  return [plural(session.exercisesCompleted, 'ejercicio'), plural(session.completedSets, 'serie'), volume ?? 'Volumen sin registrar'].join(' · ');
}
/** Newest day first; within a day, newest start first (Web grouping). */
export function groupSessionsByDate(sessions: readonly TrainingHistorySession[]) {
  const groups = new Map<string, TrainingHistorySession[]>();
  for (const session of sessions) groups.set(session.logDate, [...(groups.get(session.logDate) ?? []), session]);
  return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left))
    .map(([date, items]) => ({ date, sessions: [...items].sort((left, right) => right.startedAt.localeCompare(left.startedAt)) }));
}
/** Appends a page without duplicating sessions already shown. */
export function mergeHistoryPage(current: readonly TrainingHistorySession[], next: readonly TrainingHistorySession[]) {
  const seen = new Set(current.map(session => session.id));
  return [...current, ...next.filter(session => !seen.has(session.id))];
}
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Historical correction: only actuals and summary/notes (Web parity). Date,
// duration, routine, exercises, targets, checks and progression stay frozen.
export type CorrectionDraft = {
  energyLevel: number | null;
  performanceLevel: number | null;
  painLevel: number | null;
  notes: string;
  exercises: { id: string; sets: { setNumber: number; weight: string; reps: string }[] }[];
};
const text = (value: number | null) => value === null ? '' : String(value).replace('.', ',');
export function correctionDraft(detail: SessionDetailDto): CorrectionDraft {
  const { metadata } = detail.session;
  return {
    energyLevel: metadata.energyLevel, performanceLevel: metadata.performanceLevel, painLevel: metadata.painLevel, notes: metadata.notes ?? '',
    exercises: detail.exercises.map(exercise => ({ id: exercise.id,
      sets: exercise.payload.sets.map(set => ({ setNumber: set.setNumber, weight: text(set.actualWeightKg), reps: text(set.actualReps) })) })),
  };
}
/** Builds the full correction request; throws a user-facing message when a value is invalid. */
export function correctionInput(detail: SessionDetailDto, draft: CorrectionDraft, idempotencyKey: string): SessionCorrectionInput {
  const exercises = detail.exercises.map(exercise => {
    const edited = draft.exercises.find(item => item.id === exercise.id);
    return {
      sessionExerciseId: exercise.id, expectedUpdatedAt: exercise.updatedAt, notes: exercise.payload.notes || null,
      sets: exercise.payload.sets.map(set => {
        const row = edited?.sets.find(item => item.setNumber === set.setNumber);
        const where = `de la serie ${set.setNumber} de ${exercise.nameSnapshot}`;
        return { setNumber: set.setNumber, notes: set.notes || null,
          actualWeightKg: row ? parseDraftNumber(row.weight, `El peso ${where}`, 9999.99, false) : set.actualWeightKg,
          actualReps: row ? parseDraftNumber(row.reps, `Las reps ${where}`, 1000, true) : set.actualReps };
      }),
    };
  });
  return {
    expectedSessionUpdatedAt: detail.session.updatedAt,
    // Fields Mobile does not edit (pain note, treadmill) are preserved verbatim.
    metadata: { ...detail.session.metadata, energyLevel: draft.energyLevel, performanceLevel: draft.performanceLevel,
      painLevel: draft.painLevel, notes: draft.notes.trim() ? draft.notes : null },
    exercises, idempotencyKey,
  };
}
export function correctionIsDirty(detail: SessionDetailDto, draft: CorrectionDraft): boolean {
  return JSON.stringify(correctionDraft(detail)) !== JSON.stringify(draft);
}
