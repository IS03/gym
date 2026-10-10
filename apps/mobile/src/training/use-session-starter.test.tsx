import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, Pressable, Text } from 'react-native';

import type { MobileTrainingResponse } from '@/api/training';
import type { MobileTrainingRoutinesResponse } from '@/api/routines';
import { OwnlevelThemeProvider } from '@/design-system';

import { useSessionStarter, type SessionStartRequest } from './use-session-starter';

const mockTraining = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRoutines = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockStart = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const pushId = '11111111-1111-4111-8111-111111111111';
const archivedId = '33333333-3333-4333-8333-333333333333';
const sessionId = '22222222-2222-4222-8222-222222222222';
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const session = { id: sessionId, routineId: pushId, name: 'PUSH', logDate: '2026-09-28', startedAt: '2026-09-28T12:00:00Z' };

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-glass-effect', () => ({ GlassView: () => null, isGlassEffectAPIAvailable: () => false, isLiquidGlassAvailable: () => false }));
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
  { id: archivedId, name: 'ARCHIVED', color: 'blue', order: 1, isActive: false, exerciseCount: 1, setCount: 1 },
] }) {
  return { status: 'ok', data: { routines: data, initialPlan: { status: 'ok', data: { imported: true, routinesFound: 1 } } }, meta };
}

function Harness({ onSession, request }: { onSession: (id: string) => void; request: SessionStartRequest }) {
  const starter = useSessionStarter({ onSession });
  return <>
    <Pressable onPress={() => starter.start(request)}><Text>start</Text></Pressable>
    <Pressable onPress={() => starter.start(request)}><Text>start again</Text></Pressable>
    {starter.element}
  </>;
}
function renderStarter(request: SessionStartRequest) {
  const onSession = jest.fn();
  const view = render(<OwnlevelThemeProvider initialMode="light"><Harness onSession={onSession} request={request} /></OwnlevelThemeProvider>);
  return { ...view, onSession };
}
type AlertButton = { text?: string; onPress?: () => void };
const lastAlert = () => {
  const calls = (Alert.alert as unknown as jest.Mock).mock.calls;
  const call = calls.at(-1) as [string, string | undefined, AlertButton[]] | undefined;
  return call ? { buttons: call[2], message: call[1], title: call[0] } : null;
};
const press = (label: string) => act(() => { lastAlert()!.buttons.find(button => button.text === label)!.onPress?.(); });

describe('Session starter (no chooser)', () => {
  beforeEach(() => {
    [mockTraining, mockRoutines, mockStart].forEach(mock => mock.mockReset());
    mockTraining.mockResolvedValue(training());
    mockRoutines.mockResolvedValue(routines());
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('starts the chosen routine once, with an idempotency key, showing only "Iniciando…"', async () => {
    mockStart.mockResolvedValue({ status: 'ok', data: { status: 'started', session }, meta });
    const view = renderStarter({ routineId: pushId });
    fireEvent.press(view.getByText('start'));
    fireEvent.press(view.getByText('start again')); // a second tap while starting does nothing
    expect(view.getByTestId('session-starting')).toBeTruthy();
    await waitFor(() => expect(view.onSession).toHaveBeenCalledWith(sessionId));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart.mock.calls[0]?.[1]).toMatchObject({ routineId: pushId, idempotencyKey: expect.any(String) });
    expect(view.queryByTestId('session-starting')).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('a free session starts with no routine', async () => {
    mockStart.mockResolvedValue({ status: 'ok', data: { status: 'started', session }, meta });
    const view = renderStarter({ free: true });
    fireEvent.press(view.getByText('start'));
    await waitFor(() => expect(view.onSession).toHaveBeenCalledWith(sessionId));
    expect(mockStart.mock.calls[0]?.[1]).toMatchObject({ routineId: null });
  });

  it('an existing active session is offered to continue, without a write', async () => {
    mockTraining.mockResolvedValue(training({ status: 'ok', data: session }));
    const view = renderStarter({ routineId: pushId });
    fireEvent.press(view.getByText('start'));
    await waitFor(() => expect(lastAlert()?.title).toBe('Ya tenés una sesión en curso'));
    press('Continuar');
    expect(view.onSession).toHaveBeenCalledWith(sessionId);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('an unverifiable active-session read never starts; Reintentar reads again', async () => {
    mockTraining.mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta });
    const view = renderStarter({ routineId: pushId });
    fireEvent.press(view.getByText('start'));
    await waitFor(() => expect(lastAlert()?.title).toBe('No pudimos verificar tu sesión'));
    expect(mockStart).not.toHaveBeenCalled();
    mockStart.mockResolvedValue({ status: 'ok', data: { status: 'started', session }, meta });
    press('Reintentar');
    await waitFor(() => expect(view.onSession).toHaveBeenCalledWith(sessionId));
    expect(mockTraining).toHaveBeenCalledTimes(2);
  });

  it('ACTIVE_SESSION_EXISTS turns into the continue choice, without a retry', async () => {
    mockStart.mockResolvedValue({ status: 'conflict', code: 'ACTIVE_SESSION_EXISTS', data: { status: 'active', code: 'ACTIVE_SESSION_EXISTS', session }, message: 'active', meta });
    const view = renderStarter({ routineId: pushId });
    fireEvent.press(view.getByText('start'));
    await waitFor(() => expect(lastAlert()?.title).toBe('Ya tenés una sesión en curso'));
    press('Cancelar');
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(view.onSession).not.toHaveBeenCalled();
    expect(view.queryByTestId('session-starting')).toBeNull();
  });

  it('an ambiguous failure is retried only explicitly, with the same key', async () => {
    mockStart.mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta })
      .mockResolvedValueOnce({ status: 'ok', data: { status: 'started', session }, meta });
    const view = renderStarter({ routineId: pushId });
    fireEvent.press(view.getByText('start'));
    await waitFor(() => expect(lastAlert()?.title).toBe('No pudimos iniciar el entrenamiento'));
    expect(mockStart).toHaveBeenCalledTimes(1);
    press('Reintentar');
    await waitFor(() => expect(view.onSession).toHaveBeenCalledWith(sessionId));
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockStart.mock.calls[1]?.[1]).toEqual(mockStart.mock.calls[0]?.[1]);
  });

  it('a reused key or a missing routine is explained, never retried', async () => {
    mockStart.mockResolvedValue({ status: 'conflict', code: 'IDEMPOTENCY_KEY_REUSED', message: 'reused', meta });
    const reused = renderStarter({ routineId: pushId });
    fireEvent.press(reused.getByText('start'));
    await waitFor(() => expect(lastAlert()?.message).toMatch(/Este intento ya se usó/));
    expect(lastAlert()!.buttons.map(button => button.text)).toEqual(['OK']);
    reused.unmount();
    mockStart.mockReset();
    const archived = renderStarter({ routineId: archivedId });
    fireEvent.press(archived.getByText('start'));
    await waitFor(() => expect(lastAlert()?.title).toBe('La rutina ya no está disponible'));
    expect(mockStart).not.toHaveBeenCalled();
  });
});
