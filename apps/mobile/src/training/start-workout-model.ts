import type { MobileTrainingRoutine } from '@/api/routines';

export type StartSelection = { kind: 'free' } | { kind: 'routine'; routineId: string };

export function sameStartSelection(a: StartSelection | null, b: StartSelection): boolean {
  return a?.kind === b.kind && (a.kind === 'free' || (b.kind === 'routine' && a.routineId === b.routineId));
}

export function activeStartRoutines(routines: MobileTrainingRoutine[]): MobileTrainingRoutine[] {
  return routines.filter((routine) => routine.isActive).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function initialStartSelection(routines: MobileTrainingRoutine[], initialRoutineId?: string): StartSelection | null {
  return initialRoutineId && routines.some((routine) => routine.id === initialRoutineId && routine.isActive)
    ? { kind: 'routine', routineId: initialRoutineId }
    : null;
}

export function validStartSelection(selection: StartSelection | null, routines: MobileTrainingRoutine[]): StartSelection | null {
  return selection?.kind === 'routine' && !routines.some((routine) => routine.id === selection.routineId && routine.isActive)
    ? null : selection;
}

export function startCtaLabel(selection: StartSelection | null, routines: MobileTrainingRoutine[]): string {
  if (!selection) return 'Elegí una opción';
  if (selection.kind === 'free') return 'Empezar sesión libre';
  const routine = routines.find((item) => item.id === selection.routineId);
  return routine ? `Empezar ${routine.name}` : 'Elegí una opción';
}

export function startRoutineMeta(routine: MobileTrainingRoutine): string {
  return `${routine.exerciseCount} ${routine.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ${routine.setCount} ${routine.setCount === 1 ? 'serie' : 'series'}`;
}

function selectionIdentity(selection: StartSelection): string {
  return selection.kind === 'free' ? 'free' : `routine:${selection.routineId}`;
}

export class StartIntent {
  private intent: { selection: string; key: string } | null = null;

  constructor(private readonly generateKey: () => string = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `start-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }) {}

  keyFor(selection: StartSelection): string {
    const identity = selectionIdentity(selection);
    if (this.intent?.selection !== identity) {
      this.intent = { selection: identity, key: this.generateKey() };
    }
    return this.intent.key;
  }

  reset(): void { this.intent = null; }
}
