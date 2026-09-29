import type { RoutineDetail } from './routine-editor';

export const detailFixture: RoutineDetail = {
  routine: {
    id: '11111111-1111-4111-8111-111111111111', name: 'PUSH', color: 'violet', isActive: true,
    updatedAt: '2026-09-28T12:00:00.123456+00:00', templateVersion: 3,
  },
  items: [{
    routineExerciseId: '33333333-3333-4333-8333-333333333333', exerciseOrder: 1,
    exercise: {
      id: '22222222-2222-4222-8222-222222222222', name: 'Press', muscleGroup: 'pecho',
      muscleGroupLabel: null, implement: 'Barra', weightMode: 'Peso total', isActive: false,
    },
    updatedAt: '2026-09-28T12:00:00.123456+00:00',
    targets: {
      nextAdjustment: 'custom', nextAdjustmentNote: 'Más control',
      restMinSeconds: null, restMaxSeconds: 0, notes: 'Agarre',
      sets: [{ setNumber: 1, targetReps: 0, targetWeightKg: null, targetRir: 0, notes: 'Legacy set note' }],
    },
  }],
};
