import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RefreshControl } from 'react-native';

import type { MobileTrainingResponse } from '@/api/training';
import { OwnlevelThemeProvider } from '@/design-system';

import { TrainingScreen } from './training-screen';

const mockFetchMobileTraining = jest.fn();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockUseApiResource = jest.fn();
const mockHaptic = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useFocusEffect: () => undefined,
}));
jest.mock('./start-workout-modal', () => ({
  StartWorkoutModal: () => {
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return <Text>Start Workout Modal</Text>;
  },
}));
jest.mock('@/api', () => ({
  fetchMobileTraining: (...args: unknown[]) => mockFetchMobileTraining(...args),
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: {} }),
}));
jest.mock('@/platform/haptics', () => ({
  haptics: { selection: () => mockHaptic() },
}));

const now = () => new Date(2026, 8, 21, 12);

function fixture(): MobileTrainingResponse {
  return {
    activeSession: { status: 'ok', data: null },
    calendar: { status: 'ok', data: { month: '2026-09', days: [] } },
  };
}

function okResult(data: MobileTrainingResponse) {
  return {
    status: 'ok' as const,
    data,
    meta: { durationMs: 20, httpStatus: 200, outcome: 'ok' as const },
  };
}

function renderScreen() {
  return render(
    <OwnlevelThemeProvider initialMode="light">
      <TrainingScreen now={now} />
    </OwnlevelThemeProvider>,
  );
}

describe('Training resource screen', () => {
  beforeEach(() => {
    mockFetchMobileTraining.mockReset();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    mockUseApiResource.mockReset();
    mockHaptic.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it('uses a structure-matched skeleton during initial loading', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: { status: 'loading', trigger: 'initial' },
    });

    const view = renderScreen();

    expect(view.getByTestId('training-loading')).toBeTruthy();
  });

  it('supports native pull-to-refresh without replacing confirmed data', () => {
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

    expect(view.getByTestId('training-dashboard')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('preserves stale data after a failed refresh', () => {
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
          meta: { durationMs: 20, httpStatus: null, outcome: 'unavailable' },
        },
      },
    });
    const view = renderScreen();

    expect(view.getByTestId('training-dashboard')).toBeTruthy();
    expect(view.getByTestId('training-stale')).toBeTruthy();
  });

  it('shows global unavailable only without confirmed content', () => {
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'unavailable',
        reason: 'network',
        result: {
          status: 'unavailable',
          reason: 'network',
          meta: { durationMs: 20, httpStatus: null, outcome: 'unavailable' },
        },
      },
    });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(view.getByTestId('training-unavailable')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('opens start flow from New Session without writing on entry', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'ready',
        current: { confirmedAt: 1, data },
        refreshing: false,
        trigger: 'initial',
        result: okResult(data),
      },
    });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: '+ Nueva sesión' }));

    expect(view.getByText('Start Workout Modal')).toBeTruthy();
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockFetchMobileTraining).not.toHaveBeenCalled();
  });

  it('routes an active session to the bridge, History to its screen and calendar days to the day', () => {
    const data = fixture();
    data.activeSession = { status: 'ok', data: {
      id: '11111111-1111-4111-8111-111111111111', name: 'PUSH', logDate: '2026-09-21',
    } };
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: { status: 'ready', current: { confirmedAt: 1, data }, refreshing: false, trigger: 'initial', result: okResult(data) },
    });
    const view = renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Continuar entrenamiento →' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/session/11111111-1111-4111-8111-111111111111');
    fireEvent.press(view.getByRole('button', { name: 'Abrir Historial' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/history');
    expect(view.queryByText('Historial estará disponible en M3.4.')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Abrir calendario' }));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/calendar');
    fireEvent.press(view.getByTestId('training-calendar-today'));
    expect(mockPush).toHaveBeenLastCalledWith(expect.stringMatching(/^\/\(tabs\)\/train\/day\/\d{4}-\d{2}-\d{2}$/));
  });

  it('navigates Rutinas to the native Training stack screen', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'ready',
        current: { confirmedAt: 1, data },
        refreshing: false,
        trigger: 'initial',
        result: okResult(data),
      },
    });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Abrir Rutinas' }));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/routines');
    expect(view.queryByText(/Rutinas estará disponible/)).toBeNull();
  });

  it('navigates Ejercicios to the native library screen', () => {
    const data = fixture();
    mockUseApiResource.mockReturnValue({
      refresh: mockRefresh,
      state: {
        status: 'ready',
        current: { confirmedAt: 1, data },
        refreshing: false,
        trigger: 'initial',
        result: okResult(data),
      },
    });
    const view = renderScreen();

    fireEvent.press(view.getByRole('button', { name: 'Abrir Ejercicios' }));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/exercises');
    expect(view.queryByText(/Ejercicios estará disponible/)).toBeNull();
  });
});
