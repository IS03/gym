import { act, fireEvent, render, within } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MobileHomeResponse } from '@/api/home';
import { OwnlevelThemeProvider } from '@/design-system';

import { HOME_FOCUS_REFRESH_MS } from './home-data';
import { HomeScreen } from './home-screen';
import { homeProgressBody, homeProgressTraining } from './home-test-fixtures';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockFocusEffects: (() => void)[] = [];
const mockFetchHome = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchDay = jest.fn<(client: unknown, date: string) => Promise<unknown>>();
const mockFetchQuick = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchReport = jest.fn<(client: unknown, query: unknown) => Promise<unknown>>();
const mockFetchHistory = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchProgressBody = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchProgressWeek = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchProgressRecords = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockConfigOpen = jest.fn();
type MockModalProps = { onClose: () => void; onContinue: (id: string) => void; onStarted: (id: string) => void };
let mockModalProps: MockModalProps | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: mockPush }),
  useFocusEffect: (effect: () => void) => { mockFocusEffects.push(effect); },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: unknown }) => children, isLiquidGlassAvailable: () => false }));
jest.mock('@/platform/haptics', () => ({ haptics: { selection: jest.fn() } }));
jest.mock('@/auth', () => ({ useMobileAuth: () => ({ session: { user: { id: 'u1', user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/p' } } } }) }));
jest.mock('@/nutrition/config-provider', () => ({ useNutritionConfiguration: () => ({ controller: { open: mockConfigOpen } }) }));
jest.mock('@/api', () => ({
  ...jest.requireActual<object>('@/api'),
  fetchMobileHome: (...args: unknown[]) => mockFetchHome(...args),
  useMobileApi: () => ({ client: {} }),
}));
jest.mock('@/api/history', () => ({ fetchHistoryDay: (c: unknown, d: string) => mockFetchDay(c, d) }));
jest.mock('@/api/nutrition-quick', () => ({ fetchQuickOptions: (...args: unknown[]) => mockFetchQuick(...args) }));
jest.mock('@/api/nutrition-report', () => ({ fetchNutritionReport: (c: unknown, q: unknown) => mockFetchReport(c, q) }));
jest.mock('@/api/training-history', () => ({ fetchTrainingHistory: (...args: unknown[]) => mockFetchHistory(...args) }));
jest.mock('@/api/progress', () => ({
  ...jest.requireActual<object>('@/api/progress'),
  fetchProgressBody: (...args: unknown[]) => mockFetchProgressBody(...args),
  fetchProgressTraining: (c: unknown, q: { period: string }, s: unknown) => q.period === '7'
    ? mockFetchProgressWeek(c, q, s) : mockFetchProgressRecords(c, q, s),
}));
// The real modal (verification, idempotency, conflicts) has its own tests.
jest.mock('@/training/start-workout-modal', () => ({
  StartWorkoutModal: (props: MockModalProps) => {
    mockModalProps = props;
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    return <MockText>start-workout-modal</MockText>;
  },
}));

const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const ok = (data: unknown) => Promise.resolve({ status: 'ok', data, meta });
const SATURDAY_NIGHT = new Date('2026-10-11T02:59:00.000Z'); // Sat 10, 23:59 Córdoba

function homeData(): MobileHomeResponse {
  return {
    date: '2026-10-10',
    profile: { status: 'ok', data: { displayName: 'Nacho' } },
    nutrition: { status: 'ok', data: { calories: 1000, calorieTarget: 2000, proteinG: 80, proteinTargetG: 150, mealCount: 2, waterL: null, waterTargetL: null, energyBalanceKcal: null } },
    training: {
      activeSession: { status: 'ok', data: null },
      workoutStartRoutines: { status: 'ok', data: [{ id: 'r1', name: 'Push', color: null, exerciseCount: 6, setCount: 18 }] },
      week: { status: 'ok', data: {
        summary: { weekStart: '2026-10-05', weekEnd: '2026-10-11', sessions: 1, sets: 18, minutes: 55, routines: {}, muscleGroups: {}, trainingDays: ['2026-10-06'] },
        todaySessions: [{ id: 'done-1', name: 'Push', startedAt: '2026-10-10T12:00:00.000Z', endedAt: '2026-10-10T12:55:00.000Z',
          durationMilliseconds: 55 * 60_000, exercisesCompleted: 6, completedSets: 18, status: 'completed' }],
      } },
    },
  };
}

const historyDay = {
  date: '2026-10-10', today: '2026-10-10', discovery: null, training: { status: 'ok', data: { sessions: [] } }, activeSession: { status: 'ok', data: null },
  nutrition: { status: 'unavailable' }, body: { date: '2026-10-10', today: '2026-10-10', weight: { status: 'ok', data: null }, measurement: { status: 'ok', data: null } },
  metrics: { status: 'ok', data: { metrics: [{ id: 'm1', systemKey: 'sleep', label: 'Sueño', unit: 'h', valueType: 'duration', target: null, value: null, isActive: true, updatedAt: null }] } },
};
const quick = { today: '2026-10-10', saved: { status: 'ok', items: [] }, suggested: { status: 'ok', items: [{
  source: { kind: 'suggestion', id: '00000000-0000-4000-8000-000000000001', version: 'a'.repeat(64) }, name: 'Batido', description: null,
  templateType: null, items: [], calories: 200, proteinG: 30, carbsG: 10, fatG: 2, useCount: 5, lastUsedDate: '2026-10-09' }] } };
const report = { summary: { metrics: { calories: { value: null, denominator: 0, partialDays: 0 } } }, days: [] };

let clock = SATURDAY_NIGHT.getTime();
const now = () => new Date(clock);

async function renderScreen() {
  const view = render(<OwnlevelThemeProvider initialMode="light"><HomeScreen now={now} /></OwnlevelThemeProvider>);
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  return view;
}
const focus = () => act(() => { mockFocusEffects.at(-1)!(); });
const allFetchers = () => [mockFetchHome, mockFetchDay, mockFetchQuick, mockFetchReport, mockFetchHistory,
  mockFetchProgressBody, mockFetchProgressWeek, mockFetchProgressRecords];

describe('Home screen', () => {
  beforeEach(() => {
    clock = SATURDAY_NIGHT.getTime();
    mockFocusEffects.length = 0;
    mockModalProps = null;
    for (const mock of [mockNavigate, mockPush, mockConfigOpen, ...allFetchers()]) mock.mockReset();
    mockFetchHome.mockImplementation(() => ok(homeData()));
    mockFetchDay.mockImplementation(() => ok(historyDay));
    mockFetchQuick.mockImplementation(() => ok(quick));
    mockFetchReport.mockImplementation(() => ok(report));
    mockFetchHistory.mockImplementation(() => ok({ sessions: [], nextCursor: null }));
    mockFetchProgressBody.mockImplementation(() => ok(homeProgressBody()));
    mockFetchProgressWeek.mockImplementation(() => ok(homeProgressTraining()));
    mockFetchProgressRecords.mockImplementation(() => ok(homeProgressTraining('30')));
  });

  it('issues every read in parallel, with the server day semantics for today and Monday', async () => {
    mockFetchHome.mockImplementation(() => new Promise(() => undefined)); // Home never answers.
    const view = await renderScreen();
    for (const fetcher of allFetchers()) expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mockFetchDay.mock.calls[0][1]).toBe('2026-10-10');
    expect(mockFetchReport.mock.calls[0][1]).toEqual({ period: 'custom', from: '2026-10-05', to: '2026-10-10' });
    expect(mockFetchProgressBody.mock.calls[0][1]).toEqual({ period: '7' });
    expect(mockFetchProgressWeek.mock.calls[0][1]).toEqual({ period: '7' });
    expect(mockFetchProgressRecords.mock.calls[0][1]).toEqual({ period: '30' });
    // Blocks with their own reads render while Home is still loading.
    expect(view.getByTestId('home-register')).toBeTruthy();
    expect(view.getByTestId('home-nutrition-loading')).toBeTruthy();
  });

  it('refreshes on tab focus only after the minimum interval, and always on a new day', async () => {
    await renderScreen();
    focus(); // first focus = initial reads
    clock += HOME_FOCUS_REFRESH_MS - 1_000;
    focus();
    expect(mockFetchHome).toHaveBeenCalledTimes(1);

    clock += 2_000;
    focus();
    expect(mockFetchHome).toHaveBeenCalledTimes(2);
    expect(mockFetchReport).toHaveBeenCalledTimes(2);

    // Midnight in Córdoba (Sunday → Monday would change the week; here Saturday → Sunday).
    clock = Date.parse('2026-10-11T03:00:05.000Z');
    await act(async () => { await Promise.resolve(); });
    focus();
    expect(mockFetchHome).toHaveBeenCalledTimes(3);
    expect(mockFetchDay.mock.calls.at(-1)![1]).toBe('2026-10-11');
  });

  it('a read after midnight on Sunday asks for the new week', async () => {
    clock = Date.parse('2026-10-12T02:59:00.000Z'); // Sunday 23:59
    await renderScreen();
    expect(mockFetchReport.mock.calls[0][1]).toEqual({ period: 'custom', from: '2026-10-05', to: '2026-10-11' });
    focus(); // first focus = initial reads
    clock = Date.parse('2026-10-12T03:00:00.000Z'); // Monday 00:00, seconds later
    focus();
    expect(mockFetchReport.mock.calls.at(-1)![1]).toEqual({ period: 'custom', from: '2026-10-12', to: '2026-10-12' });
  });

  it('opens Profile/Settings, Progress and the existing Nutrition flows', async () => {
    const view = await renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Abrir perfil' }));
    fireEvent.press(view.getByRole('button', { name: 'Abrir ajustes' }));
    fireEvent.press(view.getByRole('button', { name: 'Ver progreso' }));
    fireEvent.press(view.getByRole('button', { name: 'Nueva comida' }));
    fireEvent.press(view.getByRole('button', { name: 'Batido' }));
    expect(mockPush.mock.calls).toEqual([['/settings'], ['/settings']]);
    expect(mockNavigate.mock.calls).toEqual([
      ['/(tabs)/progress'],
      [{ pathname: '/(tabs)/nutrition', params: { add: '1' } }],
      [{ pathname: '/(tabs)/nutrition', params: { quick: 'suggestion:00000000-0000-4000-8000-000000000001' } }],
    ]);
  });

  it('Registrar opens the weight entry, today\'s metrics editor and all metrics', async () => {
    const view = await renderScreen();
    fireEvent.press(within(view.getByTestId('home-register')).getByRole('button', { name: 'Peso' }));
    fireEvent.press(view.getByRole('button', { name: 'Sueño' }));
    fireEvent.press(view.getByRole('button', { name: 'Más métricas' }));
    expect(mockPush.mock.calls).toEqual([
      [{ pathname: '/(tabs)/progress/body', params: { registrar: 'peso' } }],
      [{ pathname: '/(tabs)/progress/metrics', params: { editar: 'metricas' } }],
      ['/(tabs)/progress/metrics'],
    ]);
  });

  it('Ver detalle opens the finished session; a strip day opens that day in the history', async () => {
    mockFetchHistory.mockImplementation(() => ok({ sessions: [{ id: 's', routineId: null, routineName: 'Push', routineColor: null, logDate: '2026-10-06',
      startedAt: '2026-10-06T12:00:00.000Z', endedAt: '2026-10-06T13:00:00.000Z', durationMilliseconds: 3_600_000, exercisesCompleted: 6, completedSets: 18, volumeKg: null }], nextCursor: null }));
    const view = await renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Ver detalle' }));
    fireEvent.press(view.getByTestId('home-week-day-2026-10-06'));
    expect(mockPush.mock.calls).toEqual([
      [{ pathname: '/(tabs)/train/history/[id]', params: { id: 'done-1' } }],
      [{ pathname: '/history/day/[date]', params: { date: '2026-10-06' } }],
    ]);
  });

  it('Elegir rutina reuses StartWorkoutModal and follows the session it reports', async () => {
    const data = homeData();
    if (data.training.week.status === 'ok') data.training.week.data.todaySessions = [];
    mockFetchHome.mockImplementation(() => ok(data));
    const view = await renderScreen();
    expect(view.queryByText('start-workout-modal')).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina' }));
    expect(view.getByText('start-workout-modal')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => mockModalProps!.onStarted('started-1'));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/train/session/started-1');
    expect(view.queryByText('start-workout-modal')).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina' }));
    act(() => mockModalProps!.onContinue('active-9'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/train/session/active-9');

    fireEvent.press(view.getByRole('button', { name: 'Elegir rutina' }));
    act(() => mockModalProps!.onClose());
    expect(view.queryByText('start-workout-modal')).toBeNull();
  });

  it('Entrenar otra vez opens the same verified start flow after a completed session', async () => {
    const view = await renderScreen();
    fireEvent.press(view.getByRole('button', { name: 'Entrenar otra vez' }));
    expect(view.getByText('start-workout-modal')).toBeTruthy();
    act(() => mockModalProps!.onStarted('second-session'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/train/session/second-session');
  });

  it('opens each progress detail preserving its period and exercise identity', async () => {
    const view = await renderScreen();
    fireEvent.press(within(view.getByTestId('home-progress-weight')).getByRole('button'));
    fireEvent.press(within(view.getByTestId('home-progress-training')).getByRole('button'));
    fireEvent.press(within(view.getByTestId('home-progress-records')).getByRole('button'));
    expect(mockPush.mock.calls).toEqual([
      [{ pathname: '/(tabs)/progress/trends/body', params: { period: '7' } }],
      [{ pathname: '/(tabs)/progress/trends/training', params: { period: '7' } }],
      [{ pathname: '/(tabs)/progress/trends/exercise/[id]', params: { id: 'bench-id', period: '30' } }],
    ]);
  });

  it('passes the Google photo from the session to the avatar', async () => {
    const view = await renderScreen();
    expect(view.getByTestId('home-avatar-photo', { includeHiddenElements: true }).props.source).toEqual({ uri: 'https://lh3.googleusercontent.com/a/p' });
  });

  it('without any confirmed Home read, shows the unavailable state with an explicit retry', async () => {
    mockFetchHome.mockImplementation(() => Promise.resolve({ status: 'unavailable', reason: 'network', meta }));
    const view = await renderScreen();
    expect(view.getByTestId('home-unavailable')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Reintentar' }));
    expect(mockFetchHome).toHaveBeenCalledTimes(2);
  });
});
