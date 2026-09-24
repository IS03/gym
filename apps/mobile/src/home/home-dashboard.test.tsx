import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

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
  const onRefresh = jest.fn();
  const view = render(
    <OwnlevelThemeProvider initialMode={options.theme ?? 'light'}>
      <HomeDashboard
        data={data}
        isStale={options.isStale ?? false}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
      />
    </OwnlevelThemeProvider>,
  );
  return { ...view, onNavigate, onRefresh };
}

describe('real native Home dashboard', () => {
  it('renders the real profile, active session, summaries and populated today sessions', () => {
    const view = renderHome(homeFixture());

    expect(view.getByText('Nacho')).toBeTruthy();
    expect(view.getByText('Sesión en curso')).toBeTruthy();
    expect(view.getAllByText('Upper A').length).toBeGreaterThan(0);
    expect(view.getByLabelText('Progreso de la sesión: 40%')).toBeTruthy();
    expect(view.getAllByText('0 kcal').length).toBeGreaterThan(0);
    expect(view.getByText('Upper A ×2')).toBeTruthy();
    expect(view.getByText('Pecho 8 · Espalda 6')).toBeTruthy();
    expect(view.getByText('Sesiones de hoy')).toBeTruthy();
    expect(view.getByText('Movilidad')).toBeTruthy();
    expect(
      view.getByLabelText(
        'L, 2026-09-21: entrenamiento completado y sesión en curso, hoy',
      ),
    ).toBeTruthy();
  });

  it('uses only real navigation targets', () => {
    const view = renderHome(homeFixture());

    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil y ajustes' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Entrenar' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Nutrición' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Progreso' }));

    expect(view.onNavigate.mock.calls.map(([target]) => target)).toEqual([
      'settings',
      'train',
      'nutrition',
      'progress',
    ]);
  });

  it('renders the honest no-session state and omits empty today sessions', () => {
    const data = homeFixture();
    data.training.activeSession = { status: 'ok', data: null };
    if (data.training.week.status === 'ok') {
      data.training.week.data.todaySessions = [];
    }
    const view = renderHome(data);

    expect(view.getByText('Listo para entrenar')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Ir a Entrenar' })).toBeTruthy();
    expect(view.queryByText('Sesiones de hoy')).toBeNull();
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

    expect(view.getByText('Perfil')).toBeTruthy();
    expect(view.getByText('Estado no disponible')).toBeTruthy();
    expect(view.getByText('No pudimos cargar Nutrición.')).toBeTruthy();
    expect(view.getByText('No pudimos cargar el resumen semanal.')).toBeTruthy();
    expect(view.getByText('Accesos rápidos')).toBeTruthy();
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
