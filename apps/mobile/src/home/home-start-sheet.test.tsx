import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import type { MobileHomeWorkoutStartRoutine } from '@/api/home';
import { OwnlevelThemeProvider } from '@/design-system';

import type { HomeTrainingWeek } from './home-data';
import { HomeStartContent, routineLastTime } from './home-start-sheet';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/ui', () => ({ BottomSheet: () => null, Host: () => null, RNHostView: () => null }));

const push: MobileHomeWorkoutStartRoutine = { id: 'r1', name: 'Push', color: 'violet', exerciseCount: 6, setCount: 20 };
const legs: MobileHomeWorkoutStartRoutine = { id: 'r2', name: 'Legs', color: null, exerciseCount: 1, setCount: 1 };
const session = (routineId: string | null, minutes: number | null, sets: number) => ({
  id: `s-${routineId}`, routineId, routineName: 'x', routineColor: null, logDate: '2026-10-06', startedAt: '2026-10-06T12:00:00.000Z',
  endedAt: '2026-10-06T13:00:00.000Z', durationMilliseconds: minutes === null ? null : minutes * 60_000, exercisesCompleted: 4, completedSets: sets, volumeKg: null,
});
const week = (complete: boolean): HomeTrainingWeek => ({
  weekStart: '2026-10-05', sessions: [], everTrained: true, historyComplete: complete,
  recent: [session('r1', 52, 21), session('r1', 40, 10), session(null, 30, 8)],
});

function renderContent(props: Partial<Parameters<typeof HomeStartContent>[0]> = {}) {
  const handlers = { onCreateRoutine: jest.fn(), onFree: jest.fn(), onPickRoutine: jest.fn() };
  const view = render(
    <OwnlevelThemeProvider initialMode="light">
      <HomeStartContent {...handlers} plan={null} routines={{ status: 'ok', data: [push, legs] }} week={week(false)} {...props} />
    </OwnlevelThemeProvider>,
  );
  return { ...view, ...handlers };
}

describe('Start sheet', () => {
  it('"Última vez" is the newest session of that routine; never "Sin registros" from a partial history', () => {
    expect(routineLastTime(push, week(false))).toBe('Última vez: 52 min · 21 series');
    expect(routineLastTime(legs, week(false))).toBe('1 ejercicio · 1 serie');
    expect(routineLastTime(legs, week(true))).toBe('Sin registros todavía');
    expect(routineLastTime(push, undefined)).toBe('6 ejercicios · 20 series');
    expect(routineLastTime(push, { ...week(true), recent: [session('r1', null, 3)] })).toBe('Última vez: 3 series');
  });

  it('no plan: "¿Qué entrenás hoy?", every routine and always "Entrenar libre"', () => {
    const view = renderContent();
    expect(view.getByRole('header', { name: '¿Qué entrenás hoy?' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Legs. 1 ejercicio · 1 serie' }));
    fireEvent.press(view.getByRole('button', { name: 'Entrenar libre' }));
    expect(view.onPickRoutine).toHaveBeenCalledWith('r2');
    expect(view.onFree).toHaveBeenCalledTimes(1);
  });

  it('routines unavailable: says so and still offers a free session', () => {
    const view = renderContent({ routines: { status: 'unavailable' } });
    expect(view.getByText('No pudimos cargar tus rutinas. Podés entrenar libre.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Entrenar libre' })).toBeTruthy();
  });

  it('with a plan (future Programs): "Hoy te toca X" with Empezar and "Elegir otra rutina"', () => {
    const view = renderContent({ plan: { routineId: 'r1', routineName: 'Push' } });
    expect(view.getByText('Hoy te toca')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Empezar' }));
    expect(view.onPickRoutine).toHaveBeenCalledWith('r1');
    fireEvent.press(view.getByRole('button', { name: 'Elegir otra rutina' }));
    expect(view.getByRole('header', { name: '¿Qué entrenás hoy?' })).toBeTruthy();
  });
});
