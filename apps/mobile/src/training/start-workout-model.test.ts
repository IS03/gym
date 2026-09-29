import { describe, expect, it } from '@jest/globals';

import type { MobileTrainingRoutine } from '@/api/routines';

import { activeStartRoutines, initialStartSelection, sameStartSelection, StartIntent, startCtaLabel, startRoutineMeta, validStartSelection } from './start-workout-model';

const routines: MobileTrainingRoutine[] = [
  { id: 'b', name: 'PULL', color: 'blue', order: 2, isActive: true, exerciseCount: 2, setCount: 6 },
  { id: 'a', name: 'PUSH', color: 'violet', order: 1, isActive: true, exerciseCount: 1, setCount: 3 },
  { id: 'c', name: 'LEGS', color: 'green', order: 0, isActive: false, exerciseCount: 3, setCount: 9 },
];

describe('start workout model', () => {
  it('sorts active routines, excludes archived, confirms initial selection and labels CTA', () => {
    const active = activeStartRoutines(routines);
    expect(active.map((routine) => routine.id)).toEqual(['a', 'b']);
    expect(initialStartSelection(routines, 'a')).toEqual({ kind: 'routine', routineId: 'a' });
    expect(initialStartSelection(routines, 'c')).toBeNull();
    expect(initialStartSelection(routines, 'missing')).toBeNull();
    expect(validStartSelection({ kind: 'routine', routineId: 'c' }, active)).toBeNull();
    expect(startCtaLabel(null, active)).toBe('Elegí una opción');
    expect(startCtaLabel({ kind: 'free' }, active)).toBe('Empezar sesión libre');
    expect(startCtaLabel({ kind: 'routine', routineId: 'a' }, active)).toBe('Empezar PUSH');
    expect(startRoutineMeta(active[0]!)).toBe('1 ejercicio · 3 series');
    expect(sameStartSelection({ kind: 'free' }, { kind: 'free' })).toBe(true);
  });

  it('keeps one key for the same intent, changes with selection, resets on close', () => {
    let number = 0;
    const intent = new StartIntent(() => `key-${++number}`);
    const push = { kind: 'routine' as const, routineId: 'a' };
    expect(intent.keyFor(push)).toBe('key-1');
    expect(intent.keyFor(push)).toBe('key-1');
    expect(intent.keyFor({ kind: 'free' })).toBe('key-2');
    intent.reset();
    expect(intent.keyFor({ kind: 'free' })).toBe('key-3');
  });
});
