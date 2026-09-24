import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RefreshControl } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import { OwnlevelThemeProvider } from '@/design-system';

import { HomeScreen } from './home-screen';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn<() => Promise<void>>();
const mockUseApiResource = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: () => null,
}));

jest.mock('@/api', () => ({
  fetchMobileHome: jest.fn(),
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: {} }),
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

  it('maps Home actions only to existing tabs and Settings', () => {
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
    fireEvent.press(view.getByRole('button', { name: 'Abrir Entrenar' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Nutrición' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir Progreso' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil y ajustes' }));

    expect(mockNavigate.mock.calls).toEqual([
      ['/(tabs)/train'],
      ['/(tabs)/nutrition'],
      ['/(tabs)/progress'],
    ]);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
