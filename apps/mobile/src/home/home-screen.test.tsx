import { act, fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RefreshControl } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import { OwnlevelThemeProvider } from '@/design-system';

import { HomeScreen } from './home-screen';

const mockNavigate = jest.fn();
const mockFocusEffects: (() => void)[] = [];
const mockPush = jest.fn();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockUseApiResource = jest.fn();
type MockModalProps = { onClose: () => void; onContinue: (id: string) => void; onStarted: (id: string) => void };
let mockModalProps: MockModalProps | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
  useFocusEffect: (effect: () => void) => { mockFocusEffects.push(effect); },
}));

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('@/api', () => ({
  fetchMobileHome: jest.fn(),
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: {} }),
}));

// The real modal (verification, idempotency, conflicts) is covered by its own tests;
// here we only check that Home reuses it and follows the session it reports.
jest.mock('@/training/start-workout-modal', () => ({
  StartWorkoutModal: (props: MockModalProps) => {
    mockModalProps = props;
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    return <MockText>start-workout-modal</MockText>;
  },
}));

jest.mock('@/platform/haptics', () => ({
  haptics: { selection: jest.fn() },
}));

function fixture(): MobileHomeResponse {
  return {
    date: '2026-09-21',
    profile: { status: 'ok', data: { displayName: 'Nacho' } },
    nutrition: {
      status: 'ok',
      data: {
        calories: 1800,
        calorieTarget: 2500,
        proteinG: 140,
        proteinTargetG: 180,
        mealCount: 4,
        waterL: 2,
        waterTargetL: 3,
        energyBalanceKcal: -300,
      },
    },
    training: {
      activeSession: { status: 'ok', data: null },
      workoutStartRoutines: { status: 'ok', data: [] },
      week: {
        status: 'ok',
        data: {
          summary: {
            weekStart: '2026-09-21',
            weekEnd: '2026-09-27',
            sessions: 0,
            sets: 0,
            minutes: 0,
            routines: {},
            muscleGroups: {},
            trainingDays: [],
          },
          todaySessions: [],
        },
      },
    },
  };
}

function renderScreen() {
  return render(
    <OwnlevelThemeProvider initialMode="light">
      <HomeScreen />
    </OwnlevelThemeProvider>,
  );
}

function okResult(data: MobileHomeResponse) {
  return {
    status: 'ok' as const,
    data,
    meta: { durationMs: 25, httpStatus: 200, outcome: 'ok' as const },
  };
}

describe('Home resource screen', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    mockNavigate.mockReset();
    mockPush.mockReset();
    mockUseApiResource.mockReset();
    mockModalProps = null;
  });

  it('uses a structure-matched skeleton during initial loading', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: { status: 'loading', trigger: 'initial' },
    });

    const view = renderScreen();

    expect(view.getByTestId('home-loading')).toBeTruthy();
    expect(view.queryByText('Cargando...')).toBeNull();
  });

  it('renders confirmed data and supports native pull-to-refresh', () => {
    const data = fixture();
    const result = okResult(data);
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'ready',
        current: { confirmedAt: 1, data },
        refreshing: false,
        trigger: 'initial',
        result,
      },
    });

    const view = renderScreen();
    fireEvent(view.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(view.getByTestId('real-home-dashboard')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('preserves prior confirmed data and labels a failed refresh as stale', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'unavailable',
        previous: { confirmedAt: 1, data },
        reason: 'network',
        result: {
          status: 'unavailable',
          reason: 'network',
          meta: {
            durationMs: 25,
            httpStatus: null,
            outcome: 'unavailable',
          },
        },
      },
    });

    const view = renderScreen();

    expect(view.getByTestId('real-home-dashboard')).toBeTruthy();
    expect(
      view.getByText(
        'No se pudo actualizar. Mostramos la última lectura confirmada.',
      ),
    ).toBeTruthy();
  });

  it('shows global unavailable only when no confirmed data exists', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'unavailable',
        reason: 'network',
        result: {
          status: 'unavailable',
          reason: 'network',
          meta: {
            durationMs: 25,
            httpStatus: null,
            outcome: 'unavailable',
          },
        },
      },
    });

    const view = renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));

    expect(view.getByTestId('home-unavailable')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes confirmed server truth whenever Home regains focus (e.g. after finishing a session)', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh,
      state: { status: 'ready', current: { confirmedAt: 1, data }, refreshing: false, trigger: 'initial', result: okResult(data) } });
    mockFocusEffects.length = 0;
    renderScreen();
    expect(mockRefresh).not.toHaveBeenCalled();
    mockFocusEffects.at(-1)!();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
  function renderReady(data: MobileHomeResponse = fixture()) {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh,
      state: { status: 'ready', current: { confirmedAt: 1, data }, refreshing: false, trigger: 'initial', result: okResult(data) } });
    return renderScreen();
  }

  it('maps header, Nutrition and Progress to Settings and their tabs', () => {
    const view = renderReady();
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil y ajustes' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir ajustes' }));
    fireEvent.press(view.getByRole('button', { name: 'Ver Nutrición' }));
    fireEvent.press(view.getByRole('button', { name: 'Ver Progreso' }));

    expect(mockPush.mock.calls).toEqual([['/settings'], ['/settings']]);
    expect(mockNavigate.mock.calls).toEqual([['/(tabs)/nutrition'], ['/(tabs)/progress']]);
  });

  it('opens the shared StartWorkoutModal instead of the Training tab and follows the started session', () => {
    const view = renderReady();
    expect(view.queryByText('start-workout-modal')).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Nueva sesión' }));
    expect(view.getByText('start-workout-modal')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    act(() => mockModalProps!.onStarted('started-1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/session/started-1');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(view.queryByText('start-workout-modal')).toBeNull();
  });

  it('continues an active session detected by the modal, and closes cleanly', () => {
    const view = renderReady();
    fireEvent.press(view.getByRole('button', { name: 'Nueva sesión' }));
    act(() => mockModalProps!.onContinue('active-9'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/session/active-9');
    expect(view.queryByText('start-workout-modal')).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Nueva sesión' }));
    act(() => mockModalProps!.onClose());
    expect(view.queryByText('start-workout-modal')).toBeNull();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('continues the active session directly and opens completed sessions in their detail', () => {
    const data = fixture();
    data.training.activeSession = { status: 'ok', data: {
      id: 'active-1', name: 'Upper A', logDate: '2026-09-21', startedAt: '2026-09-21T18:00:00.000Z',
      exercisesCompleted: 1, totalExercises: 4, completedSets: 3, totalSets: 12, progressPercent: 25,
    } };
    if (data.training.week.status === 'ok') {
      data.training.week.data.todaySessions = [{
        id: 'done-1', name: 'Movilidad', startedAt: '2026-09-21T11:00:00.000Z', endedAt: '2026-09-21T11:30:00.000Z',
        durationMilliseconds: 30 * 60_000, exercisesCompleted: 4, completedSets: 8, status: 'completed',
      }];
    }
    const view = renderReady(data);

    fireEvent.press(view.getByRole('button', { name: 'Continuar entrenamiento' }));
    fireEvent.press(view.getByRole('button', { name: /^Movilidad\./ }));
    expect(mockPush.mock.calls).toEqual([
      ['/(tabs)/train/session/active-1'],
      [{ pathname: '/(tabs)/train/history/[id]', params: { id: 'done-1' } }],
    ]);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
