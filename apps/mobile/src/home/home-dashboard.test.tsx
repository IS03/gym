import { fireEvent, render, within } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { Image, StyleSheet } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import { OwnlevelThemeProvider, type ThemeMode } from '@/design-system';

import { HomeDashboard, type HomeNavigationTarget } from './home-dashboard';

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

function homeFixture(): MobileHomeResponse {
  return {
    date: '2026-09-21',
    profile: { status: 'ok', data: { displayName: 'Nacho Ownlevel' } },
    nutrition: {
      status: 'ok',
      data: {
        calories: 0,
        calorieTarget: 2500,
        proteinG: 0,
        proteinTargetG: 180,
        mealCount: 0,
        waterL: 0,
        waterTargetL: 3,
        energyBalanceKcal: 0,
      },
    },
    training: {
      activeSession: {
        status: 'ok',
        data: {
          id: 'active-1',
          name: 'Upper A',
          logDate: '2026-09-21',
          startedAt: '2026-09-21T18:00:00.000Z',
          exercisesCompleted: 2,
          totalExercises: 5,
          completedSets: 6,
          totalSets: 15,
          progressPercent: 40,
        },
      },
      workoutStartRoutines: {
        status: 'ok',
        data: [
          {
            id: 'routine-1',
            name: 'Upper A',
            color: 'violet',
            exerciseCount: 5,
            setCount: 15,
          },
        ],
      },
      week: {
        status: 'ok',
        data: {
          summary: {
            weekStart: '2026-09-21',
            weekEnd: '2026-09-27',
            sessions: 2,
            sets: 24,
            minutes: 95,
            routines: { 'Upper A': 2 },
            muscleGroups: { Pecho: 8, Espalda: 6 },
            trainingDays: ['2026-09-21', '2026-09-23'],
          },
          todaySessions: [
            {
              id: 'completed-1',
              name: 'Movilidad',
              startedAt: '2026-09-21T11:00:00.000Z',
              endedAt: '2026-09-21T11:30:00.000Z',
              durationMilliseconds: 30 * 60_000,
              exercisesCompleted: 4,
              completedSets: 8,
              status: 'completed',
            },
          ],
        },
      },
    },
  };
}

function renderHome(
  data: MobileHomeResponse,
  options: { isStale?: boolean; theme?: ThemeMode } = {},
) {
  const onNavigate = jest.fn<(target: HomeNavigationTarget) => void>();
  const onOpenCompletedSession = jest.fn<(id: string) => void>();
  const onOpenSession = jest.fn<(id: string) => void>();
  const onRefresh = jest.fn();
  const onStartWorkout = jest.fn();
  const view = render(
    <OwnlevelThemeProvider initialMode={options.theme ?? 'light'}>
      <HomeDashboard
        data={data}
        isStale={options.isStale ?? false}
        onNavigate={onNavigate}
        onOpenCompletedSession={onOpenCompletedSession}
        onOpenSession={onOpenSession}
        onRefresh={onRefresh}
        onStartWorkout={onStartWorkout}
      />
    </OwnlevelThemeProvider>,
  );
  return { ...view, onNavigate, onOpenCompletedSession, onOpenSession, onRefresh, onStartWorkout };
}

function withoutActiveSession(data: MobileHomeResponse = homeFixture()) {
  data.training.activeSession = { status: 'ok', data: null };
  return data;
}

describe('Home V2 header', () => {
  it('greets with the first name and opens Settings from the profile block and the isotype', () => {
    const view = renderHome(homeFixture());

    expect(view.getByText('Hola,')).toBeTruthy();
    expect(view.getByText('Nacho')).toBeTruthy();
    expect(view.queryByText('OWNLEVEL')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil y ajustes' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir ajustes' }));
    expect(view.onNavigate.mock.calls).toEqual([['settings'], ['settings']]);
  });

  it.each([
    ['light', require('../../assets/brand/logo/isotipo-claro.png')],
    ['dark', require('../../assets/brand/logo/isotipo-oscuro.png')],
  ] as [ThemeMode, unknown][])('uses the real isotype for a %s background', (theme, asset) => {
    const view = renderHome(homeFixture(), { theme });
    expect(view.UNSAFE_getByType(Image).props.source).toBe(asset);
  });

  it('without a name shows a neutral greeting and avatar, never a fake name', () => {
    const data = homeFixture();
    data.profile = { status: 'ok', data: { displayName: null } };
    const view = renderHome(data);

    expect(view.getByText('Hola')).toBeTruthy();
    expect(view.queryByText('Hola,')).toBeNull();
    expect(view.queryByText('Perfil')).toBeNull();
    expect(view.getByTestId('home-avatar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows the avatar initial and truncates long names to one line', () => {
    const data = homeFixture();
    data.profile = { status: 'ok', data: { displayName: 'Maximiliano-Bartolomé Ownlevel' } };
    const view = renderHome(data);

    const avatar = view.getByTestId('home-avatar', { includeHiddenElements: true });
    expect(within(avatar).getByText('M', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByText('Maximiliano-Bartolomé').props.numberOfLines).toBe(1);
  });
});

describe('Home V2 training', () => {
  it('without an active session shows a compact card whose CTA opens the start modal', () => {
    const view = renderHome(withoutActiveSession());

    expect(view.getByText('Listo para entrenar')).toBeTruthy();
    expect(view.getByText('1 rutina disponible')).toBeTruthy();
    expect(view.queryByText('Sesión en curso')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Nueva sesión' }));
    expect(view.onStartWorkout).toHaveBeenCalledTimes(1);
    expect(view.onNavigate).not.toHaveBeenCalled();
  });

  it('keeps honest copy for no routines and unavailable routines', () => {
    const empty = withoutActiveSession();
    empty.training.workoutStartRoutines = { status: 'ok', data: [] };
    expect(renderHome(empty).getByText('Podés empezar una sesión libre.')).toBeTruthy();

    const unavailable = withoutActiveSession();
    unavailable.training.workoutStartRoutines = { status: 'unavailable' };
    expect(renderHome(unavailable).getByText('No pudimos cargar tus rutinas.')).toBeTruthy();
  });

  it('with an active session shows the gradient hero and continues straight to the session', () => {
    const view = renderHome(homeFixture());

    expect(view.getByText('Sesión en curso')).toBeTruthy();
    expect(view.getByText('Upper A')).toBeTruthy();
    expect(view.getByText('2/5 ejercicios · 6/15 series')).toBeTruthy();
    expect(view.getByText('40%')).toBeTruthy();
    expect(view.getByLabelText('Progreso de la sesión: 40%')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Nueva sesión' })).toBeNull();
    const hero = StyleSheet.flatten(view.getByTestId('home-active-hero').props.style);
    expect(hero.experimental_backgroundImage).toBe('linear-gradient(150deg, #DCCBA3 0%, #A8935F 100%)');
    expect(hero.backgroundColor).toBe('#DCCBA3');

    fireEvent.press(view.getByRole('button', { name: 'Continuar entrenamiento' }));
    expect(view.onOpenSession).toHaveBeenCalledWith('active-1');
    expect(view.onNavigate).not.toHaveBeenCalled();
  });

  it('an unverifiable active-session state never offers a start, only a retry', () => {
    const data = homeFixture();
    data.training.activeSession = { status: 'unavailable' };
    const view = renderHome(data);

    expect(view.getByText('Estado no disponible')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Nueva sesión' })).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('Home V2 weekly progress', () => {
  it('keeps sessions, sets, time and the week, without routines or muscles', () => {
    const view = renderHome(withoutActiveSession());

    expect(view.getByText('2 entrenamientos · 24 series · 1 h 35 min')).toBeTruthy();
    expect(view.getByLabelText('L, 2026-09-21: entrenamiento completado, hoy')).toBeTruthy();
    expect(view.getByLabelText('X, 2026-09-23: entrenamiento completado')).toBeTruthy();
    expect(view.getByText('Hoy')).toBeTruthy();
    expect(view.queryByText('Upper A ×2')).toBeNull();
    expect(view.queryByText('Rutinas')).toBeNull();
    expect(view.queryByText('Músculos principales')).toBeNull();
    expect(view.queryByText(/Pecho/)).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Ver Progreso' }));
    expect(view.onNavigate).toHaveBeenCalledWith('progress');
  });

  it('counts an active session this week apart from completed ones', () => {
    const view = renderHome(homeFixture());
    expect(view.getByText('2 completados · 1 en curso · 24 series · 1 h 35 min')).toBeTruthy();
    expect(view.getByLabelText('L, 2026-09-21: entrenamiento completado y sesión en curso, hoy')).toBeTruthy();
  });

  it('shows a real empty week as zeros', () => {
    const data = withoutActiveSession();
    if (data.training.week.status === 'ok') {
      data.training.week.data.summary = {
        ...data.training.week.data.summary, sessions: 0, sets: 0, minutes: 0, trainingDays: [],
      };
    }
    expect(renderHome(data).getByText('0 entrenamientos · 0 series · 0 min')).toBeTruthy();
  });
});

describe('Home V2 today sessions', () => {
  it('lists only completed sessions and opens their real detail', () => {
    const view = renderHome(homeFixture());

    expect(view.getByText('Sesiones de hoy')).toBeTruthy();
    expect(view.getAllByText('Upper A')).toHaveLength(1);
    expect(view.queryByText('En curso')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: /^Movilidad\./ }));
    expect(view.onOpenCompletedSession).toHaveBeenCalledWith('completed-1');
    expect(view.onNavigate).not.toHaveBeenCalled();
  });

  it('omits the section when only the active session exists today', () => {
    const data = homeFixture();
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [];
    const view = renderHome(data);

    expect(view.getByText('Sesión en curso')).toBeTruthy();
    expect(view.queryByText('Sesiones de hoy')).toBeNull();
  });

  it('lists several completed sessions in order', () => {
    const data = withoutActiveSession();
    if (data.training.week.status === 'ok') {
      const [first] = data.training.week.data.todaySessions;
      data.training.week.data.todaySessions = [first, { ...first, id: 'completed-2', name: 'Lower B' }];
    }
    const view = renderHome(data);
    fireEvent.press(view.getByRole('button', { name: /^Lower B\./ }));
    expect(view.onOpenCompletedSession).toHaveBeenCalledWith('completed-2');
  });
});

describe('Home V2 removed duplication', () => {
  it('has no quick access grid', () => {
    const view = renderHome(homeFixture());
    expect(view.queryByText('Accesos rápidos')).toBeNull();
    for (const name of ['Abrir Entrenar', 'Abrir Nutrición', 'Abrir Progreso', 'Abrir Ajustes']) {
      expect(view.queryByRole('button', { name })).toBeNull();
    }
  });
});

describe('Home V2 nutrition and states', () => {
  it('keeps the nutrition summary and its navigation', () => {
    const view = renderHome(homeFixture());
    expect(view.getByText('Resumen de hoy')).toBeTruthy();
    expect(view.getAllByText('0 kcal').length).toBeGreaterThan(0);
    fireEvent.press(view.getByRole('button', { name: 'Ver Nutrición' }));
    expect(view.onNavigate).toHaveBeenCalledWith('nutrition');
  });

  it('keeps real zeroes distinct from null targets', () => {
    const data = homeFixture();
    if (data.nutrition.status === 'ok') {
      data.nutrition.data.calorieTarget = null;
      data.nutrition.data.proteinTargetG = null;
      data.nutrition.data.waterL = null;
      data.nutrition.data.waterTargetL = null;
    }
    const view = renderHome(data);

    expect(view.getAllByText('Sin objetivo')).toHaveLength(3);
    expect(view.getByText('— L')).toBeTruthy();
    expect(view.getByText('0')).toBeTruthy();
    expect(view.getAllByText('0 kcal').length).toBeGreaterThan(0);
  });

  it('does not present a real zero target as missing', () => {
    const data = homeFixture();
    if (data.nutrition.status === 'ok') {
      data.nutrition.data.calorieTarget = 0;
      data.nutrition.data.proteinTargetG = 0;
      data.nutrition.data.waterTargetL = 0;
    }
    const view = renderHome(data);

    expect(view.getByText('de 0 kcal')).toBeTruthy();
    expect(view.getByText('de 0 g')).toBeTruthy();
    expect(view.getByText('de 0 L')).toBeTruthy();
  });

  it('contains independent unavailable states without replacing Home', () => {
    const data = homeFixture();
    data.profile = { status: 'unavailable' };
    data.nutrition = { status: 'unavailable' };
    data.training.activeSession = { status: 'unavailable' };
    data.training.week = { status: 'unavailable' };
    const view = renderHome(data);

    expect(view.getByText('Hola')).toBeTruthy();
    expect(view.getByText('Estado no disponible')).toBeTruthy();
    expect(view.getByText('No pudimos cargar Nutrición.')).toBeTruthy();
    expect(view.getByText('No pudimos cargar el resumen semanal.')).toBeTruthy();
    expect(view.queryByText('Sesiones de hoy')).toBeNull();
  });

  it('marks preserved data as stale and offers refresh', () => {
    const view = renderHome(homeFixture(), { isStale: true });

    expect(
      view.getByText(
        'No se pudo actualizar. Mostramos la última lectura confirmada.',
      ),
    ).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(view.onRefresh).toHaveBeenCalledTimes(1);
  });

  it.each(['dark', 'light', 'system'] as const)(
    'renders the complete Home in %s mode',
    (theme) => {
      const view = renderHome(homeFixture(), { theme });

      expect(view.getByTestId('real-home-dashboard')).toBeTruthy();
      expect(view.getByLabelText('Entrenamiento')).toBeTruthy();
      expect(view.getByText('Resumen de hoy')).toBeTruthy();
    },
  );
});
