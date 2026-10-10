import type { MobileRoutineColorKey } from '@/api/home';

export type NewSessionRoutine = {
  id: string; name: string; color: MobileRoutineColorKey | null; exerciseCount: number; setCount: number;
  /** "hoy" / "ayer" / "hace N días" from the history read; null when not read. */
  lastDone: string | null;
};

export type NewSessionRoutines =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ok'; items: NewSessionRoutine[] };

export type NewSessionRecommendation =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ok'; routine: NewSessionRoutine; weekday: string; doneToday: boolean };

export type NewSessionPage = 'start' | 'routines';

/**
 * "Nueva sesión": recommended routine (when there is one), "Elegir rutina" (pushes the
 * full list, with back) and "Sesión libre". Closes with the X, the grabber or a swipe down.
 * Picking closes the sheet; the session starts once it is fully gone (`onDismissed`).
 */
export type NewSessionSheetProps = {
  open: boolean;
  page: NewSessionPage;
  recommendation: NewSessionRecommendation;
  routines: NewSessionRoutines;
  onClose: () => void;
  onCreateRoutine: () => void;
  onDismissed: () => void;
  onFree: () => void;
  onPage: (page: NewSessionPage) => void;
  onPickRoutine: (routineId: string) => void;
};

export const routineDetail = (routine: Pick<NewSessionRoutine, 'exerciseCount' | 'setCount'>) =>
  `${routine.exerciseCount} ${routine.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · ${routine.setCount} ${routine.setCount === 1 ? 'serie' : 'series'}`;

export const NEW_SESSION_COPY = {
  title: 'Nueva sesión',
  chooseTitle: 'Elegir rutina',
  chooseSubtitle: 'Todas tus rutinas guardadas',
  freeTitle: 'Sesión libre',
  freeSubtitle: 'Empezar vacío e ir sumando ejercicios',
  routinesSubtitle: 'Todas tus rutinas guardadas.',
  noRoutines: 'Todavía no tenés rutinas.',
  createRoutine: 'Crear rutina',
  routinesUnavailable: 'No pudimos cargar tus rutinas. Podés entrenar libre.',
  mostRepeated: 'Más repetida',
  doneToday: 'Ya la hiciste hoy',
} as const;
