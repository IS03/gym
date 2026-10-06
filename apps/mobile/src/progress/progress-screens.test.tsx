import { act, fireEvent, render, within } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OwnlevelThemeProvider } from '@/design-system';
import { parseProgressBody, parseProgressMetrics, parseProgressOverview, type ProgressBody, type ProgressComparison, type ProgressMetrics, type ProgressOverview, type ProgressQuery } from '@/api/progress';
import { ProgressOverviewScreen } from './overview-screen';
import { BodyTrendsScreen } from './body-trends-screen';
import { MetricsTrendsScreen } from './metrics-trends-screen';
import { NutritionReportsRoute } from '@/nutrition/report-route';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
const mockOverview = jest.fn<(c: unknown, q: ProgressQuery) => Promise<unknown>>();
const mockBody = jest.fn<(c: unknown, q: ProgressQuery) => Promise<unknown>>();
const mockMetrics = jest.fn<(c: unknown, q: ProgressQuery, id: string | null) => Promise<unknown>>();
const mockReport = jest.fn<(c: unknown, q: unknown) => Promise<unknown>>();
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => undefined, useLocalSearchParams: () => mockParams }));
jest.mock('@/platform/haptics', () => ({ haptics: { selection: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
const mockClient = { request: jest.fn(), read: jest.fn() };
jest.mock('@/api', () => ({ useMobileApi: () => ({ client: mockClient }) }));
jest.mock('@/api/progress', () => ({ ...jest.requireActual<object>('@/api/progress'),
  fetchProgressOverview: (c: unknown, q: ProgressQuery) => mockOverview(c, q), fetchProgressBody: (c: unknown, q: ProgressQuery) => mockBody(c, q),
  fetchProgressMetrics: (c: unknown, q: ProgressQuery, id: string | null) => mockMetrics(c, q, id) }));
jest.mock('@/api/nutrition-report', () => ({ ...jest.requireActual<object>('@/api/nutrition-report'), fetchNutritionReport: (c: unknown, q: unknown) => mockReport(c, q) }));

const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const ok = <T,>(data: T) => ({ status: 'ok' as const, data, meta });
const lost = { status: 'unavailable' as const, reason: 'network' as const, meta: { durationMs: 1, httpStatus: null, outcome: 'unavailable' as const } };
const TODAY = '2026-10-05';
const period = (preset: ProgressQuery['period'] = '30', start = '2026-09-06', days = 30) => ({ preset, start, end: TODAY, days, previousStart: '2026-08-07', previousEnd: '2026-09-05', bucket: 'week' as const, includesToday: true });
const cmp = (over: Partial<ProgressComparison> = {}): ProgressComparison => ({ status: 'comparable', reason: 'eligible', current: 2200, previous: 2000, deltaAbsolute: 200, deltaPercent: 10, change: 'increased', ...over });
const ids = { steps: 'c1000000-0000-4000-8000-000000000001', sleep: 'c1000000-0000-4000-8000-000000000002', custom: 'c1000000-0000-4000-8000-000000000003' };
export function trainingSummary() {
  const c = cmp({ current: 12, previous: 9, deltaAbsolute: 3, deltaPercent: 33.3 });
  return { sessions: 12, trainingDays: 11, sets: 180, minutes: 840, sessionsPerWeek: 2.8,
    comparisons: { sessions: c, trainingDays: cmp({ current: 11, previous: 9, deltaAbsolute: 2, deltaPercent: 22.2 }), sets: cmp({ current: 180, previous: 150, deltaAbsolute: 30, deltaPercent: 20 }),
      minutes: cmp({ current: 840, previous: 600, deltaAbsolute: 240, deltaPercent: 40 }), setsPerSession: cmp({ change: 'stable' }) },
    performance: { improved: 4, stable: 3, declined: 1, comparable: 8, insufficient: 2, headline: '4 de 8 ejercicios mejoraron' } };
}
function overview(over: Partial<ProgressOverview> = {}, preset: ProgressQuery['period'] = '30'): ProgressOverview {
  return { today: TODAY, period: period(preset), training: { status: 'ok', data: trainingSummary() },
    evolution: [{ id: 'body.weight', label: 'Peso', value: '80,5 kg', detail: '−1,5 kg en el período', destination: { kind: 'body' } }],
    changes: [{ id: 'activity:steps', domain: 'metrics', label: 'Pasos', description: 'Subió frente al período anterior.', destination: { kind: 'metrics', metricId: ids.steps } }],
    nutrition: { status: 'ok', data: { averageKcal: 2200, averageProteinG: 130, averageTargetKcal: 2100, averageTargetProteinG: 140, accumulatedBalanceKcal: -3000,
      registeredDays: 10, completedDays: 10, days: 30, calories: cmp(), protein: cmp({ current: 130, previous: 120, deltaAbsolute: 10, deltaPercent: 8.3 }),
      balance: cmp({ deltaPercent: null, change: 'stable' }) } },
    metrics: { status: 'ok', data: { items: [
      { id: ids.steps, name: 'Pasos', unit: 'pasos', valueType: 'integer', average: 9000, coverage: { registered: 28, eligible: 29, ratio: 28 / 29 }, comparison: cmp({ current: 9000, previous: 6000, deltaAbsolute: 3000, deltaPercent: 50 }) },
      { id: ids.sleep, name: 'Sueño', unit: 'min', valueType: 'duration', average: 450, coverage: { registered: 5, eligible: 29, ratio: 5 / 29 }, comparison: cmp({ status: 'insufficient_data', reason: 'previous_period_empty', previous: null, deltaAbsolute: null, deltaPercent: null, change: 'insufficient_data' }) },
    ] } },
    body: { status: 'ok', data: { excludedSuspect: 1, trackedMetrics: 1 } }, ...over };
}
const obs = (date: string, value: number, imported = false) => ({ date, value, imported, provenanceLabel: imported ? 'Importado · sheet' : 'Registro de peso' });
function body(): ProgressBody {
  return { today: TODAY, period: period(), excludedSuspect: 1, metrics: [
    { key: 'body.weight', label: 'Peso', unit: 'kg', latest: obs('2026-10-01', 80.5), first: obs('2026-09-10', 82), last: obs('2026-10-01', 80.5), change: -1.5, referenceChange: null,
      trend: 'decreased', confidence: 'supported', observations: [obs('2026-09-10', 82), obs('2026-09-20', 81, true), obs('2026-10-01', 80.5)], referenceCount: 1, comparison: { status: 'insufficient_data', reason: 'previous_period_empty' } },
    { key: 'body.waist', label: 'Cintura', unit: 'cm', latest: obs('2026-09-15', 88), first: obs('2026-09-15', 88), last: obs('2026-09-15', 88), change: null, referenceChange: null,
      trend: 'unavailable', confidence: 'unavailable', observations: [obs('2026-09-15', 88)], referenceCount: 0, comparison: { status: 'insufficient_data', reason: 'insufficient_current_samples' } },
  ] };
}
const defs = [
  { id: ids.steps, systemKey: 'steps', name: 'Pasos', unit: 'pasos', valueType: 'integer' as const, isActive: true, currentTarget: 10000 },
  { id: ids.sleep, systemKey: 'sleep', name: 'Sueño', unit: 'min', valueType: 'duration' as const, isActive: true, currentTarget: 480 },
  { id: ids.custom, systemKey: null, name: 'Mate viejo', unit: 'L', valueType: 'decimal' as const, isActive: false, currentTarget: null },
];
function metrics(id: string | null): ProgressMetrics {
  const metric = defs.find(d => d.id === id) ?? defs[0];
  return { today: TODAY, period: { ...period('7', '2026-09-29', 7), bucket: 'day', previousStart: '2026-09-22', previousEnd: '2026-09-28' }, definitions: defs, metric,
    summary: { average: metric.id === ids.sleep ? 450 : 0, median: 0, minimum: 0, maximum: 0, registeredDays: 2, eligibleDays: 6, coverageRatio: 2 / 6, trendDelta: 0, trendPercentDelta: null },
    previous: { average: 0, registeredDays: 3, eligibleDays: 7 }, comparison: cmp({ current: 0, previous: 0, deltaAbsolute: 0, deltaPercent: null, change: 'stable' }),
    series: ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((d, i) => ({ start: d, end: d, value: i % 3 === 0 ? 0 : null, samples: i % 3 === 0 ? 1 : 0 })) };
}
const flush = () => act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); });
const wrap = (el: React.ReactElement) => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
  <OwnlevelThemeProvider initialMode="light">{el}</OwnlevelThemeProvider></SafeAreaProvider>);

const listeners: ((s: string) => void)[] = [];
beforeEach(() => {
  jest.clearAllMocks(); mockParams = {}; listeners.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, l) => { listeners.push(l as (s: string) => void); return { remove: jest.fn() } as never; });
  mockOverview.mockImplementation(async (_c, q) => ok(overview({}, q.period)));
  mockBody.mockImplementation(async () => ok(body()));
  mockMetrics.mockImplementation(async (_c, _q, id) => ok(metrics(id)));
});

describe('Progress fixtures follow the shared contract', () => {
  it('overview, body and metrics fixtures are valid contract payloads', () => {
    expect(parseProgressOverview(overview())).toBeDefined(); expect(parseProgressBody(body())).toBeDefined(); expect(parseProgressMetrics(metrics(ids.sleep))).toBeDefined();
  });
});

describe('Progress Overview', () => {
  it('defaults to 30 days and shows evolution, findings, habits with comparisons/coverage, explore and operational links', async () => {
    const view = wrap(<ProgressOverviewScreen />); await flush();
    expect(mockOverview).toHaveBeenLastCalledWith(mockClient, { period: '30' });
    expect(within(view.getByTestId('progress-evolution')).getByText('80,5 kg')).toBeTruthy();
    expect(view.getByText('1 medición sospechosa excluida del análisis.')).toBeTruthy();
    expect(within(view.getByTestId('progress-changes')).getByText('Subió frente al período anterior.')).toBeTruthy();
    const nutrition = within(view.getByTestId('progress-nutrition'));
    expect(nutrition.getByText('2.200 kcal/día')).toBeTruthy(); expect(nutrition.getByText('+200 kcal (+10%) frente al período anterior.')).toBeTruthy();
    expect(nutrition.getByText('Objetivo histórico promedio: 2.100 kcal')).toBeTruthy();
    expect(within(view.getByTestId(`progress-habit-${ids.steps}`)).getByText(/\+3\.000 pasos \(\+50%\)/)).toBeTruthy();
    const sleep = within(view.getByTestId(`progress-habit-${ids.sleep}`));
    expect(sleep.getByText('7 h 30 min')).toBeTruthy(); expect(sleep.getByText(/el período anterior no tiene datos/)).toBeTruthy();
    expect(sleep.getByText('5 de 29 días con dato · cobertura baja')).toBeTruthy();
    const training = within(view.getByTestId('progress-training'));
    expect(training.getByText('+3 sesiones (+33,3%) frente al período anterior.')).toBeTruthy();
    expect(training.getByText('Ejercicios: 4 mejoraron · 3 estables · 1 bajó · 2 sin comparación')).toBeTruthy();
    expect(view.queryByText(/volumen/i)).toBeNull();
    fireEvent.press(view.getByRole('button', { name: 'Tendencias de Entrenamiento' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/progress/trends/training', params: { period: '30' } });
    for (const name of ['Abrir Historial', 'Abrir Cuerpo', 'Abrir Métricas diarias']) expect(view.getByRole('button', { name })).toBeTruthy();
  });
  it('changing the period re-reads; a late response for the previous period is never shown', async () => {
    let release!: (v: unknown) => void;
    mockOverview.mockImplementationOnce(() => new Promise(r => { release = r; }));
    const view = wrap(<ProgressOverviewScreen />); await flush();
    fireEvent.press(view.getByRole('radio', { name: '7 días' })); await flush();
    expect(mockOverview).toHaveBeenLastCalledWith(mockClient, { period: '7' });
    await act(async () => { release(ok(overview({ evolution: [{ id: 'stale', label: 'Viejo', value: '1 kg', detail: null, destination: { kind: 'body' } }] }, '30'))); }); await flush();
    expect(view.queryByText('Viejo')).toBeNull();
    expect(view.getByText(/7 días · /)).toBeTruthy();
    fireEvent.press(view.getByRole('radio', { name: '3 meses' })); await flush();
    fireEvent.press(view.getByRole('radio', { name: '1 año' })); await flush();
    expect(mockOverview.mock.calls.map(c => c[1].period)).toEqual(['30', '7', '3m', '1y']);
  });
  it('custom: invalid or longer than 366 days is rejected locally; a valid range is requested', async () => {
    const view = wrap(<ProgressOverviewScreen />); await flush();
    fireEvent.press(view.getByRole('radio', { name: 'Personalizado' }));
    fireEvent.changeText(view.getByLabelText('Desde (DD/MM/AAAA)'), '01/01/2025');
    fireEvent.changeText(view.getByLabelText('Hasta (DD/MM/AAAA)'), '05/10/2026');
    fireEvent.press(view.getByRole('button', { name: 'Consultar rango' }));
    expect(view.getByText('El período personalizado admite hasta 366 días.')).toBeTruthy();
    fireEvent.changeText(view.getByLabelText('Desde (DD/MM/AAAA)'), '01/09/2026');
    fireEvent.press(view.getByRole('button', { name: 'Consultar rango' })); await flush();
    expect(mockOverview).toHaveBeenLastCalledWith(mockClient, { period: 'custom', from: '2026-09-01', to: '2026-10-05' });
  });
  it('an unavailable domain is explicit (never zero or empty) and drilldowns carry the period', async () => {
    mockOverview.mockImplementation(async (_c, q) => ok(overview({ nutrition: { status: 'unavailable' }, body: { status: 'unavailable' }, training: { status: 'unavailable' }, evolution: [] }, q.period)));
    const view = wrap(<ProgressOverviewScreen />); await flush();
    expect(view.getByText('No pudimos cargar Nutrición. No significa que no haya datos.')).toBeTruthy();
    expect(view.getByText('No pudimos cargar Cuerpo. El resto del resumen sigue disponible.')).toBeTruthy();
    expect(view.queryByText(/0 kcal/)).toBeNull();
    expect(view.getByText('No pudimos cargar Entrenamiento. No significa que no haya datos.')).toBeTruthy();
    fireEvent.press(view.getAllByRole('button', { name: 'Pasos' })[0]);
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/progress/trends/metrics', params: { period: '30', metric: ids.steps } });
    fireEvent.press(view.getByRole('button', { name: 'Reportes de Nutrición' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/nutrition/reports', params: { period: '30' } });
    fireEvent.press(view.getByRole('button', { name: 'Tendencias de Cuerpo' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(tabs)/progress/trends/body', params: { period: '30' } });
  });
  it('a failed first read is an error state (not empty); foreground re-reads; a failed refresh keeps the confirmed read marked stale', async () => {
    mockOverview.mockResolvedValueOnce(lost);
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    const view = wrap(<ProgressOverviewScreen />); await flush();
    expect(view.getByText('No pudimos cargar tu progreso')).toBeTruthy();
    await act(async () => { listeners.at(-1)!('background'); listeners.at(-1)!('active'); }); await flush();
    expect(view.getByText('80,5 kg')).toBeTruthy();
    mockOverview.mockResolvedValueOnce(lost);
    await act(async () => { listeners.at(-1)!('background'); listeners.at(-1)!('active'); }); await flush();
    expect(view.getByText('80,5 kg')).toBeTruthy();
    expect(view.getByText('No se pudo actualizar. Mostramos la última lectura confirmada de este período.')).toBeTruthy();
  });
});

describe('Body Trends', () => {
  it('uses the period from Progress, shows real points (imported flagged), trend, and sparse metrics as insufficient', async () => {
    mockParams = { period: '30' };
    const view = wrap(<BodyTrendsScreen />); await flush();
    expect(mockBody).toHaveBeenLastCalledWith(mockClient, { period: '30' });
    const summary = within(view.getByTestId('body-trend-summary'));
    expect(summary.getByText('Cambio: −1,5 kg')).toBeTruthy(); expect(summary.getByText('Tendencia en bajada.')).toBeTruthy();
    expect(summary.getByText('Período anterior: datos insuficientes (1 registro).')).toBeTruthy();
    expect(within(view.getByTestId('body-trend-chart')).getByText('81 kg · Importado · sheet')).toBeTruthy();
    fireEvent.press(within(view.getByTestId('body-trend-chart')).getByRole('button', { name: /20 de septiembre de 2026: 81 kg/ }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/history/day/[date]', params: { date: '2026-09-20' } });
    fireEvent.press(view.getByRole('button', { name: 'Cintura' }));
    expect(view.getByText(/Datos insuficientes para una tendencia/)).toBeTruthy();
    expect(view.queryByText(/Cambio:/)).toBeNull();
    expect(view.getByText('1 medición sospechosa excluida del análisis. Podés corregirla en Cuerpo.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Abrir Cuerpo' }));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/progress/body');
  });
});

describe('Metrics Trends', () => {
  it('selects a metric, labels the target as current, shows explicit zero, gaps and low coverage, and opens a day', async () => {
    mockParams = { period: '7', metric: ids.steps };
    const view = wrap(<MetricsTrendsScreen />); await flush();
    expect(mockMetrics).toHaveBeenLastCalledWith(mockClient, { period: '7' }, ids.steps);
    const summary = within(view.getByTestId('metric-trend-summary'));
    expect(summary.getByText('Promedio: 0 pasos')).toBeTruthy();
    expect(summary.getByText('Objetivo actual: 10.000 pasos (no hay objetivos históricos por período)')).toBeTruthy();
    expect(summary.getByText('2 de 6 días con dato · cobertura baja')).toBeTruthy();
    expect(within(view.getByTestId('metric-trend-comparison')).getByText('Estable frente al período anterior.')).toBeTruthy();
    const chart = within(view.getByTestId('metric-trend-chart'));
    expect(chart.getAllByText('Sin dato')).toHaveLength(4);
    fireEvent.press(chart.getByRole('button', { name: /29 de septiembre de 2026: 0 pasos/ }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/history/day/[date]', params: { date: '2026-09-29' } });
    fireEvent.press(view.getByRole('button', { name: 'Sueño' })); await flush();
    expect(mockMetrics).toHaveBeenLastCalledWith(mockClient, { period: '7' }, ids.sleep);
    expect(within(view.getByTestId('metric-trend-summary')).getByText('Promedio: 7 h 30 min')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Mate viejo · archivada' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Abrir Métricas diarias' }));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/progress/metrics');
  });
});

describe('Nutrition Reports route', () => {
  it('reuses the Reports component with the period chosen in Progress', async () => {
    mockParams = { period: '30' };
    mockReport.mockResolvedValue(lost);
    const view = wrap(<NutritionReportsRoute />); await flush();
    expect(mockReport).toHaveBeenLastCalledWith(mockClient, { period: '30' });
    expect(view.getByTestId('nutrition-report-screen')).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Cerrar reporte' })).toBeNull();
  });
});
