import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { MobileHomeResponse } from '@/api/home';
import type { TrainingHistorySession } from '@/api/training-history';
import { OwnlevelThemeProvider } from '@/design-system';
import { TrainingScreen } from './training-screen';

const mockHome = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTraining = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockHistory = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRoutines = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockStart = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockHaptic = jest.fn();
const mockClient = {};
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const routineId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const active = { id: sessionId, routineId, name: 'PUSH', logDate: '2026-10-07', startedAt: '2026-10-07T12:00:00Z' };
const now = () => new Date('2026-10-07T18:00:00Z');

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@expo/ui', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Host: View, RNHostView: View, BottomSheet: ({ isPresented, children }: { isPresented: boolean; children: React.ReactNode }) => isPresented ? <View>{children}</View> : null };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }), useFocusEffect: () => undefined }));
jest.mock('@/api/home', () => ({ fetchMobileHome: (...args: unknown[]) => mockHome(...args) }));
jest.mock('@/api/training', () => ({ fetchMobileTraining: (...args: unknown[]) => mockTraining(...args) }));
jest.mock('@/api/training-history', () => ({ fetchTrainingHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock('@/api', () => ({
  useMobileApi: () => ({ client: mockClient }),
  useApiResource: (jest.requireActual('@/api/resource') as typeof import('@/api/resource')).useApiResource,
  fetchMobileTraining: (...args: unknown[]) => mockTraining(...args),
  fetchMobileTrainingRoutines: (...args: unknown[]) => mockRoutines(...args),
  startMobileTrainingSession: (...args: unknown[]) => mockStart(...args),
}));
jest.mock('@/platform/haptics', () => ({ haptics: { selection: () => mockHaptic() } }));

const ok = <T,>(data: T) => ({ status: 'ok', data, meta });
const session = (id: string, date: string, name = 'PUSH'): TrainingHistorySession => ({
  id, routineId, routineName: name, routineColor: 'blue', logDate: date, startedAt: `${date}T12:00:00Z`, endedAt: `${date}T13:00:00Z`,
  durationMilliseconds: 74 * 60_000, exercisesCompleted: 1, completedSets: 21, volumeKg: null,
});
function home(): MobileHomeResponse {
  return { date: '2026-10-07', profile: { status: 'unavailable' }, nutrition: { status: 'unavailable' }, training: {
    activeSession: { status: 'ok', data: null }, week: { status: 'unavailable' },
    workoutStartRoutines: { status: 'ok', data: [
      { id: routineId, name: 'PUSH', color: 'blue', exerciseCount: 8, setCount: 24 },
      { id: 'r2', name: 'PULL', color: null, exerciseCount: 10, setCount: 26 },
      { id: 'r3', name: 'LEGS', color: 'green', exerciseCount: 8, setCount: 24 },
      { id: 'r4', name: 'ABS', color: 'violet', exerciseCount: 4, setCount: 12 },
    ] },
  } };
}
function renderScreen() {
  return render(<SafeAreaProvider initialMetrics={{ frame: { height: 844, width: 390, x: 0, y: 0 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
    <OwnlevelThemeProvider initialMode="light"><TrainingScreen now={now} /></OwnlevelThemeProvider>
  </SafeAreaProvider>);
}
describe('Training native hub', () => {
  beforeEach(() => {
    [mockHome, mockTraining, mockHistory, mockRoutines, mockStart, mockPush, mockReplace, mockHaptic].forEach(mock => mock.mockReset());
    mockHome.mockResolvedValue(ok(home()));
    mockTraining.mockImplementation(async (_client, month) => ok({ activeSession: { status: 'ok', data: null }, calendar: { status: 'ok', data: { month, days: month === '2026-10' ? [
      { date: '2026-10-05', colors: ['blue', 'rose'] }, { date: '2026-10-07', colors: ['blue'] },
    ] : [] } } }));
    mockHistory.mockResolvedValue(ok({ sessions: [session('today', '2026-10-07'), session('monday', '2026-10-05', 'PULL')], nextCursor: null }));
    mockRoutines.mockResolvedValue(ok({ routines: { status: 'ok', data: [{ id: routineId, name: 'PUSH', color: 'blue', order: 1, isActive: true, exerciseCount: 8, setCount: 24 }] }, initialPlan: { status: 'ok', data: { imported: true, routinesFound: 1 } } }));
    mockStart.mockResolvedValue({ status: 'ok', data: { status: 'started', session: active }, meta });
  });
  it('shows skeleton then manual first three routines, without recency reads', async () => {
    const view = renderScreen(); expect(view.getByTestId('training-loading')).toBeTruthy();
    await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar LEGS' })).toBeTruthy());
    expect(view.getAllByRole('button').filter(node => node.props.accessibilityLabel?.startsWith('Iniciar ')).map(node => node.props.accessibilityLabel)).toEqual(['Iniciar PUSH', 'Iniciar PULL', 'Iniciar LEGS']);
    expect(view.queryByRole('button', { name: 'Iniciar ABS' })).toBeNull();
    expect(mockTraining.mock.calls.map(call => call[1]).sort()).toEqual(['2026-09', '2026-10']);
    expect(mockHistory).toHaveBeenCalledTimes(1); expect(mockStart).not.toHaveBeenCalled();
  });
  it('selects days in hub and sheet without rereading the same week', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByTestId('training-completed-today')).toBeTruthy());
    fireEvent.press(view.getByTestId('training-week-day-2026-10-05'));
    expect(view.getByTestId('training-completed-monday')).toBeTruthy(); expect(view.queryByTestId('training-completed-today')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Abrir calendario' }));
    const sheet = within(view.getByTestId('training-calendar-sheet-content'));
    expect(sheet.getAllByTestId(/training-month-dot-/, { includeHiddenElements: true })).toHaveLength(2);
    expect(sheet.getByText('Sesiones · semana')).toBeTruthy(); expect(sheet.getByText('Series · semana')).toBeTruthy(); expect(sheet.getByText('42')).toBeTruthy();
    fireEvent.press(sheet.getByTestId('training-month-day-2026-10-07'));
    expect(view.getByTestId('training-week-day-2026-10-07').props.accessibilityState.selected).toBe(true);
    expect(view.getByTestId('training-completed-today')).toBeTruthy(); expect(mockHistory).toHaveBeenCalledTimes(1); expect(mockHaptic).toHaveBeenCalledTimes(2);
    fireEvent.press(sheet.getByRole('button', { name: /Miércoles 7.*abrir día/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/history/day/[date]', params: { date: '2026-10-07' } });
  });
  it('routes session details and existing subflows without starting a workout', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByTestId('training-completed-today')).toBeTruthy());
    fireEvent.press(view.getByTestId('training-completed-today')); expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/history/today');
    for (const [label, route] of [['Rutinas', 'routines'], ['Ejercicios', 'exercises'], ['Historial', 'history']]) {
      fireEvent.press(view.getByRole('button', { name: `Abrir ${label}` })); expect(mockPush).toHaveBeenCalledWith(`/(tabs)/train/${route}`);
    }
    fireEvent.press(view.getByRole('button', { name: 'Abrir rutina PUSH' })); expect(mockPush).toHaveBeenCalledWith(`/(tabs)/train/routines/${routineId}`);
    expect(mockStart).not.toHaveBeenCalled();
  });
  it('preserves cached content after failed refresh without claiming false zeros', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByTestId('training-completed-today')).toBeTruthy());
    const failure = { status: 'unavailable', reason: 'network', meta };
    mockHome.mockResolvedValue(failure); mockTraining.mockResolvedValue(failure); mockHistory.mockResolvedValue(failure);
    await act(async () => fireEvent(view.UNSAFE_getByType(RefreshControl), 'refresh'));
    await waitFor(() => expect(view.getByTestId('training-stale')).toBeTruthy());
    expect(view.getByTestId('training-completed-today')).toBeTruthy(); expect(view.queryByText('Sin entrenamiento este día')).toBeNull();
  });
  it('distinguishes unavailable from empty and keeps the normal free-session flow', async () => {
    mockHistory.mockResolvedValue({ status: 'unavailable', reason: 'network', meta });
    const view = renderScreen(); await waitFor(() => expect(view.getByText('No pudimos cargar las sesiones de esta semana.')).toBeTruthy());
    expect(view.queryByText('Hoy · 0 sesiones')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Nueva sesión' }));
    await waitFor(() => expect(view.getByRole('radio', { name: /Sesión libre/ })).toBeTruthy()); expect(mockStart).not.toHaveBeenCalled();
  });
  it('starts from one play tap once, with the shared idempotent flow', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Iniciar PUSH' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/(tabs)/train/session/${sessionId}`));
    expect(mockStart).toHaveBeenCalledTimes(1); expect(mockStart.mock.calls[0]?.[1]).toMatchObject({ routineId, idempotencyKey: expect.any(String) });
  });
  it('guards play with the existing active-session notice and no write', async () => {
    mockTraining.mockImplementation(async (_client, month) => ok({ activeSession: { status: 'ok', data: active }, calendar: { status: 'ok', data: { month, days: [] } } }));
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Iniciar PUSH' }));
    await waitFor(() => expect(view.getByTestId('start-active-session')).toBeTruthy()); expect(mockStart).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Continuar entrenamiento →' })); expect(mockReplace).toHaveBeenCalledWith(`/(tabs)/train/session/${sessionId}`);
  });
  it('handles ACTIVE_SESSION_EXISTS from play with existing conflict UI, no retry', async () => {
    mockStart.mockResolvedValue({ status: 'conflict', code: 'ACTIVE_SESSION_EXISTS', data: { status: 'active', code: 'ACTIVE_SESSION_EXISTS', session: active }, message: 'active', meta });
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Iniciar PUSH' }));
    await waitFor(() => expect(view.getByTestId('start-active-session')).toBeTruthy()); expect(mockStart).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
  });
  it('requires explicit retry after an ambiguous play result, retaining its key', async () => {
    mockStart.mockResolvedValueOnce({ status: 'unavailable', reason: 'network', meta });
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Iniciar PUSH' }));
    await waitFor(() => expect(view.getByText(/No pudimos iniciar el entrenamiento/)).toBeTruthy()); expect(mockStart).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Empezar PUSH' })));
    expect(mockStart).toHaveBeenCalledTimes(2); expect(mockStart.mock.calls[1]?.[1]).toEqual(mockStart.mock.calls[0]?.[1]);
  });
  it('renders a resolved empty month/week honestly and offers routine creation', async () => {
    const data = home(); data.training.workoutStartRoutines = { status: 'ok', data: [] };
    mockHome.mockResolvedValue(ok(data));
    mockTraining.mockImplementation(async (_client, month) => ok({ activeSession: { status: 'ok', data: null }, calendar: { status: 'ok', data: { month, days: [] } } }));
    mockHistory.mockResolvedValue(ok({ sessions: [], nextCursor: null }));
    const view = renderScreen(); await waitFor(() => expect(view.getByText('Sin entrenamiento este día')).toBeTruthy());
    expect(view.getByText('0 días entrenados')).toBeTruthy(); expect(view.queryByRole('button', { name: 'Iniciar PUSH' })).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Creá tu primera rutina' })); expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/routines');
    fireEvent.press(view.getByRole('button', { name: 'Abrir calendario' }));
    const sheet = within(view.getByTestId('training-calendar-sheet-content'));
    expect(sheet.getByText('Sin entrenamientos esta semana')).toBeTruthy(); expect(sheet.getAllByText('0')).toHaveLength(3);
  });
  it('keeps missing month/week metrics unavailable rather than displaying zeros', async () => {
    const failure = { status: 'unavailable', reason: 'network', meta };
    mockTraining.mockResolvedValue(failure); mockHistory.mockResolvedValue(failure);
    const view = renderScreen(); await waitFor(() => expect(view.getByText('No disponible')).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Abrir calendario' }));
    const sheet = within(view.getByTestId('training-calendar-sheet-content'));
    expect(sheet.getAllByText('—')).toHaveLength(3); expect(sheet.queryByText('0')).toBeNull();
    expect(sheet.queryByText('Sin entrenamientos esta semana')).toBeNull();
  });
  it('navigates months with cached monthly reads, not per-day/history recency reads', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    fireEvent.press(view.getByRole('button', { name: 'Abrir calendario' }));
    fireEvent.press(view.getByRole('button', { name: 'Mes anterior' }));
    expect(view.getByText('Septiembre 2026')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Mes siguiente' }));
    expect(mockTraining).toHaveBeenCalledTimes(2); expect(mockHistory).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Mes siguiente' })));
    expect(view.getByText('Noviembre 2026')).toBeTruthy(); expect(mockTraining).toHaveBeenCalledTimes(3); expect(mockHistory).toHaveBeenCalledTimes(1);
  });
  it('continues the shared active hero without duplicating it among completed sessions', async () => {
    const data = home(); data.training.activeSession = { status: 'ok', data: { ...active, exercisesCompleted: 2, totalExercises: 8, completedSets: 6, totalSets: 24, progressPercent: 25 } };
    mockHome.mockResolvedValue(ok(data));
    const view = renderScreen(); await waitFor(() => expect(view.getByTestId('training-active-session')).toBeTruthy());
    expect(view.queryByTestId(`training-completed-${sessionId}`)).toBeNull();
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Volver' })));
    expect(mockPush).toHaveBeenCalledWith(`/(tabs)/train/session/${sessionId}`); expect(mockStart).not.toHaveBeenCalled();
  });
  it('does not auto-start when the active-session read cannot be verified', async () => {
    const view = renderScreen(); await waitFor(() => expect(view.getByRole('button', { name: 'Iniciar PUSH' })).toBeTruthy());
    mockTraining.mockResolvedValue({ status: 'unavailable', reason: 'network', meta });
    await act(async () => fireEvent.press(view.getByRole('button', { name: 'Iniciar PUSH' })));
    expect(view.getByTestId('start-active-unavailable')).toBeTruthy(); expect(mockStart).not.toHaveBeenCalled();
  });
});
