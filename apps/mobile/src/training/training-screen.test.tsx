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

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

  it('turns future CTAs into temporary native feedback without API writes', () => {
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

    expect(view.getByText('Nueva sesión estará disponible en M3.2.')).toBeTruthy();
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockFetchMobileTraining).not.toHaveBeenCalled();
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
});
