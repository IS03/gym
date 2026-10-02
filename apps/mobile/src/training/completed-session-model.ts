import type { SessionDetailDto, SessionFinishedDto, SessionFinishMetadata, SessionSetDto } from '@/api/active-session';
import { durationLabel, historyLoadLabel } from './active-session-model';

// Read-only projection of a closed session. Derived only from server truth;
// it never reads local drafts or the active-session controller.
export type CompletedMetadataItem = { key: keyof SessionFinishMetadata; label: string; value: string };
export type CompletedSessionModel = {
  name: string;
  status: 'completed' | 'discarded';
  logDate: string;
  duration: string | null;
  exerciseCount: number;
  completedExerciseCount: number;
  completedSetCount: number;
  metadata: CompletedMetadataItem[];
  exercises: { id: string; name: string; identity: string; sets: { setNumber: number; label: string; completed: boolean }[] }[];
};

export function sessionDuration(startedAt: string, endedAt: string | null): string | null {
  if (!endedAt) return null;
  const milliseconds = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? durationLabel(milliseconds) : null;
}
/** Only answered fields are shown: missing stays absent, a recorded 0 pain is shown. */
export function metadataItems(metadata: SessionFinishMetadata): CompletedMetadataItem[] {
  const items: CompletedMetadataItem[] = [];
  if (metadata.energyLevel !== null) items.push({ key: 'energyLevel', label: 'Energía', value: `${metadata.energyLevel}/5` });
  if (metadata.performanceLevel !== null) items.push({ key: 'performanceLevel', label: 'Rendimiento', value: `${metadata.performanceLevel}/5` });
  if (metadata.painLevel !== null) items.push({ key: 'painLevel', label: 'Dolor', value: `${metadata.painLevel}/10` });
  if (metadata.notes) items.push({ key: 'notes', label: 'Notas', value: metadata.notes });
  return items;
}
function setLabel(set: SessionSetDto) { return historyLoadLabel(set); }
export function completedSessionModel(detail: SessionDetailDto): CompletedSessionModel {
  const { session } = detail;
  const exercises = detail.exercises.map(exercise => ({
    id: exercise.id, name: exercise.nameSnapshot,
    identity: [exercise.muscleGroupLabelSnapshot, exercise.implementSnapshot, exercise.weightModeSnapshot].filter(Boolean).join(' · '),
    sets: exercise.payload.sets.map(set => ({ setNumber: set.setNumber, label: setLabel(set), completed: set.isCompleted })),
  }));
  return {
    name: session.name, status: session.status === 'discarded' ? 'discarded' : 'completed', logDate: session.logDate,
    duration: sessionDuration(session.startedAt, session.endedAt), exerciseCount: exercises.length,
    completedExerciseCount: exercises.filter(exercise => exercise.sets.some(set => set.completed)).length,
    completedSetCount: exercises.reduce((total, exercise) => total + exercise.sets.filter(set => set.completed).length, 0),
    metadata: metadataItems({ energyLevel: session.metadata.energyLevel, performanceLevel: session.metadata.performanceLevel,
      painLevel: session.metadata.painLevel, notes: session.metadata.notes }),
    exercises,
  };
}
/** Post-workout base: exactly the finish response's server truth. */
export function postWorkoutSummary(finished: SessionFinishedDto) {
  return {
    name: finished.name, duration: sessionDuration(finished.startedAt, finished.endedAt),
    line: [plural(finished.completedSetCount, 'serie completada', 'series completadas'),
      plural(finished.completedExerciseCount, 'ejercicio', 'ejercicios')].join(' · '),
    metadata: metadataItems(finished.metadata),
  };
}
function plural(value: number, singular: string, pluralForm: string) { return `${value} ${value === 1 ? singular : pluralForm}`; }
