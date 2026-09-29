import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MobileTrainingResponse } from '@/api/training';
import { OwnlevelThemeProvider } from '@/design-system';

import { ActiveSessionBridgeScreen } from './active-session-bridge-screen';

const mockRefresh = jest.fn<() => Promise<void>>();
const mockUseApiResource = jest.fn();
const mockReplace = jest.fn();
const routeId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({ id: routeId }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/api', () => ({
  useApiResource: (...args: unknown[]) => mockUseApiResource(...args),
  useMobileApi: () => ({ client: {} }),
  fetchMobileTraining: jest.fn(),
}));

function state(activeSession: MobileTrainingResponse['activeSession']) {
  const data: MobileTrainingResponse = { activeSession, calendar: { status: 'unavailable' } };
  return { status: 'ready', refreshing: false, current: { confirmedAt: 1, data } };
}
function renderScreen() {
  return render(<OwnlevelThemeProvider initialMode="light"><ActiveSessionBridgeScreen /></OwnlevelThemeProvider>);
}

describe('post-start bridge', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    mockUseApiResource.mockReset();
  });

  it('shows loading then verified matching session, not a fake editor', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: { status: 'loading' } });
    expect(renderScreen().getByTestId('session-bridge-loading')).toBeTruthy();
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: state({ status: 'ok', data: { id: routeId, name: 'PUSH', logDate: '2026-09-28' } }) });
    const view = renderScreen();
    expect(view.getByTestId('session-bridge-active')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Sesión en curso' })).toBeTruthy();
    expect(view.getByText(/El registro de series se incorpora/)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Volver a Entrenar' }));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/train');
  });

  it('handles inactive and different active session from server truth', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: state({ status: 'ok', data: null }) });
    expect(renderScreen().getByTestId('session-bridge-inactive')).toBeTruthy();
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: state({ status: 'ok', data: { id: otherId, name: 'PULL', logDate: '2026-09-28' } }) });
    const view = renderScreen();
    expect(view.getByTestId('session-bridge-different')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Continuar sesión actual' }));
    expect(mockReplace).toHaveBeenCalledWith(`/(tabs)/train/session/${otherId}`);
  });

  it('retries unavailable instead of assuming the session ended', () => {
    mockUseApiResource.mockReturnValue({ refresh: mockRefresh, state: state({ status: 'unavailable' }) });
    const view = renderScreen();
    expect(view.getByTestId('session-bridge-unavailable')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
