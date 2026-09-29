import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MobileTrainingResponse } from '@/api/training';
import type { MobileTrainingRoutinesResponse } from '@/api/routines';
import { OwnlevelThemeProvider } from '@/design-system';

import { StartWorkoutModal } from './start-workout-modal';

const mockTraining = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRoutines = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockStart = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const pushId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const session = { id: sessionId, routineId: pushId, name: 'PUSH', logDate: '2026-09-28', startedAt: '2026-09-28T12:00:00Z' };

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@/api', () => ({
  useApiResource: (jest.requireActual('@/api/resource') as typeof import('@/api/resource')).useApiResource,
  useMobileApi: () => ({ client: {} }),
  fetchMobileTraining: (...args: unknown[]) => mockTraining(...args),
  fetchMobileTrainingRoutines: (...args: unknown[]) => mockRoutines(...args),
  startMobileTrainingSession: (...args: unknown[]) => mockStart(...args),
}));
jest.mock('@/platform/haptics', () => ({ haptics: { selection: jest.fn() } }));

function training(active: MobileTrainingResponse['activeSession'] = { status: 'ok', data: null }) {
  return { status: 'ok', data: { activeSession: active, calendar: { status: 'ok', data: { month: '2026-09', days: [] } } }, meta };
}
function routines(data: MobileTrainingRoutinesResponse['routines'] = { status: 'ok', data: [
  { id: pushId, name: 'PUSH', color: 'violet', order: 2, isActive: true, exerciseCount: 7, setCount: 21 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'ARCHIVED', color: 'blue', order: 1, isActive: false, exerciseCount: 1, setCount: 1 },
] }) {
  return { status: 'ok', data: { routines: data, initialPlan: { status: 'ok', data: { imported: true, routinesFound: 1 } } }, meta };
}
function renderModal(initialRoutineId?: string) {
  const onClose = jest.fn();
  const onContinue = jest.fn();
  const onStarted = jest.fn();
  const view = render(
    <SafeAreaProvider initialMetrics={{ frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <OwnlevelThemeProvider initialMode="light">
        <StartWorkoutModal initialRoutineId={initialRoutineId} onClose={onClose} onContinue={onContinue} onStarted={onStarted} />
      </OwnlevelThemeProvider>
    </SafeAreaProvider>,
  );
  return { ...view, onClose, onContinue, onStarted };
}

describe('native start workout flow', () => {
  beforeEach(() => {
    mockTraining.mockReset();
    mockRoutines.mockReset();
    mockStart.mockReset();
    mockTraining.mockResolvedValue(training());
    mockRoutines.mockResolvedValue(routines());
  });

  it('confirms routine selection from read, excludes archived and starts once', async () => {
    mockStart.mockResolvedValue({ status: 'ok', data: { status: 'started', session }, meta });
    const view = renderModal(pushId);
    await waitFor(() => expect(view.getByRole('button', { name: 'Empezar PUSH' })).toBeTruthy());
    expect(view.queryByText('ARCHIVED')).toBeNull();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' })));
    await waitFor(() => expect(view.onStarted).toHaveBeenCalledWith(sessionId));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart.mock.calls[0]?.[1]).toMatchObject({ routineId: pushId });
  });

  it('blocks start when active read is unavailable; routines unavailable still permits free', async () => {
    mockTraining.mockResolvedValue(training({ status: 'unavailable' }));
    const blocked = renderModal();
    await waitFor(() => expect(blocked.getByText('No pudimos verificar si tenés una sesión en curso.')).toBeTruthy());
    expect(blocked.getByRole('button', { name: 'Elegí una opción' }).props.accessibilityState?.disabled ?? blocked.getByRole('button', { name: 'Elegí una opción' }).props.disabled).toBeTruthy();
    blocked.unmount();
    mockTraining.mockResolvedValue(training());
    mockRoutines.mockResolvedValue(routines({ status: 'unavailable' }));
    const free = renderModal();
    await waitFor(() => expect(free.getByText('No pudimos cargar tus rutinas. Todavía podés iniciar una sesión libre.')).toBeTruthy());
    fireEvent.press(free.getByRole('radio', { name: /Sesión libre/ }));
    expect(free.getByRole('button', { name: 'Empezar sesión libre' })).toBeTruthy();
  });

  it('shows an existing active session without a write and continues to the bridge', async () => {
    mockTraining.mockResolvedValue(training({ status: 'ok', data: session }));
    const view = renderModal();
    await waitFor(() => expect(view.getByTestId('start-active-session')).toBeTruthy());
    expect(view.queryByText('Sesión libre')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Continuar entrenamiento →' }));
    expect(view.onContinue).toHaveBeenCalledWith(sessionId);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('turns ACTIVE_SESSION_EXISTS into active state without retry', async () => {
    mockStart.mockResolvedValue({ status: 'conflict', code: 'ACTIVE_SESSION_EXISTS', data: { status: 'active', code: 'ACTIVE_SESSION_EXISTS', session }, message: 'active', meta });
    const view = renderModal();
    await waitFor(() => expect(view.getByRole('radio', { name: /Sesión libre/ })).toBeTruthy());
    fireEvent.press(view.getByRole('radio', { name: /Sesión libre/ }));
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar sesión libre' })));
    await waitFor(() => expect(view.getByTestId('start-active-session')).toBeTruthy());
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(view.onStarted).not.toHaveBeenCalled();
  });

  it('keeps a reused-key conflict explicit and requires a new selection', async () => {
    mockStart.mockResolvedValue({ status: 'conflict', code: 'IDEMPOTENCY_KEY_REUSED', message: 'reused', meta });
    const view = renderModal(pushId);
    await waitFor(() => expect(view.getByRole('button', { name: 'Empezar PUSH' })).toBeTruthy());
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' })));
    expect(view.getByText(/Este intento ya se usó/)).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' }));
    expect(mockStart).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByRole('radio', { name: /Sesión libre/ }));
    expect(view.getByRole('button', { name: 'Empezar sesión libre' })).toBeTruthy();
  });

  it('clears a missing routine and refreshes the catalog before another start', async () => {
    mockStart.mockResolvedValue({ status: 'not_found', message: 'missing', meta });
    const view = renderModal(pushId);
    await waitFor(() => expect(view.getByRole('button', { name: 'Empezar PUSH' })).toBeTruthy());
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' })));
    expect(view.getByText('La rutina ya no está disponible.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Elegí una opción' })).toBeTruthy();
    expect(mockRoutines).toHaveBeenCalledTimes(2);
  });

  it('retains key after ambiguous failure, changes selection key, and prevents double tap', async () => {
    mockStart.mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta });
    let release!: (value: unknown) => void;
    mockStart.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    mockStart.mockResolvedValueOnce({ status: 'validation', message: 'bad', meta });
    const view = renderModal(pushId);
    await waitFor(() => expect(view.getByRole('button', { name: 'Empezar PUSH' })).toBeTruthy());
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' })));
    await waitFor(() => expect(view.getByText(/No pudimos iniciar el entrenamiento/)).toBeTruthy());
    const firstKey = (mockStart.mock.calls[0]?.[1] as { idempotencyKey: string }).idempotencyKey;
    fireEvent.press(view.getByRole('radio', { name: /PUSH/ }));
    fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' }));
    fireEvent.press(view.getByRole('button', { name: 'Iniciando…' }));
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect((mockStart.mock.calls[1]?.[1] as { idempotencyKey: string }).idempotencyKey).toBe(firstKey);
    await act(async () => release({ status: 'validation', message: 'bad', meta }));
    fireEvent.press(view.getByRole('radio', { name: /Sesión libre/ }));
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar sesión libre' })));
    expect((mockStart.mock.calls[2]?.[1] as { idempotencyKey: string }).idempotencyKey).not.toBe(firstKey);
  });
});
