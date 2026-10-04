import { act, fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OwnlevelThemeProvider } from '@/design-system';
import { historyDay, historyFact, historyRange, historyToday } from '../../../../src/lib/mobile-api/history-fixture.test-helper';
import { nutritionFixture } from '@/nutrition/day-fixture.test-helper';
import { HistoryScreen } from './history-screen';
import { HistoryDayScreen } from './day-screen';
import { HistoryCalendarScreen } from './calendar-screen';
import { ReturnToHistoryDay } from './return-to-day';
import { historyReturnParams } from './navigation';
const mockNavigate = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockRefresh = jest.fn();
let mockParams: Record<string, string> = {}, mockData: unknown;
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ navigate: mockNavigate, push: mockPush, replace: mockReplace }) }));
jest.mock('./use-history-resource', () => ({ useHistoryResource: () => ({ data: mockData, state: { status: 'ready', refreshing: false }, refresh: mockRefresh, stale: false }) }));
const wrap = (element: React.ReactElement) => render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}><OwnlevelThemeProvider initialMode="light">{element}</OwnlevelThemeProvider></SafeAreaProvider>);
const button = (name: string) => ({ name });
beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockData = historyRange(); });
describe('M6 History navigation and composed surfaces', () => {
  it('recent rows include only confirmed facts; final-fact removal disappears after reread', () => {
    mockData = historyRange([historyFact('2026-10-03', { hasWeight: true }), historyFact()]);
    const v = wrap(<HistoryScreen />);
    fireEvent.press(v.getByRole('button', button('Calendario'))); expect(mockPush).toHaveBeenCalledWith('/history/calendar');
    fireEvent.press(v.getByLabelText('3 oct 2026. Cuerpo')); expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { date: '2026-10-03' } }));
    mockData = historyRange(); v.unmount(); const next = wrap(<HistoryScreen />);
    expect(next.getByText('Sin actividad reciente')).toBeTruthy(); expect(next.queryByLabelText('3 oct 2026. Cuerpo')).toBeNull();
  });
  it('selects empty calendar dates up to server today and displays domain indicators', () => {
    mockParams = { month: '2026-10' }; mockData = historyRange([historyFact('2026-10-03', { completedSessionsCount: 1, metricValuesCount: 1 }), historyFact()]);
    const v = wrap(<HistoryCalendarScreen />);
    expect(v.getByLabelText('2026-10-03. Training, Métricas')).toBeTruthy();
    fireEvent.press(v.getByLabelText('2026-10-04. Sin actividad'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/history/day/[date]', params: { date: historyToday, historyMonth: '2026-10' } });
    fireEvent.press(v.getByLabelText('2026-10-05. Fecha futura')); expect(mockPush).toHaveBeenCalledTimes(1);
  });
  it('shows empty day and today in progress, prev/next bounded by server', () => {
    mockParams = { date: historyToday }; mockData = historyDay(); const v = wrap(<HistoryDayScreen />);
    expect(v.getByText('Hoy · en curso')).toBeTruthy(); expect(v.getByTestId('global-day-empty')).toBeTruthy();
    fireEvent.press(v.getByRole('button', button('Día siguiente'))); expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.press(v.getByRole('button', button('Día anterior'))); expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ params: { date: '2026-10-03' } }));
  });
  it('shows all domain summaries, partial coverage and exact date drilldown without false empty', () => {
    const d = historyDay('2026-10-03'); const n = nutritionFixture();
    if (n.nutrition.status === 'ok') { const { meals: _meals, ...projection } = n.nutrition.data; d.nutrition = { status: 'ok', data: projection }; }
    d.body.weight = { status: 'ok', data: { date: d.date, weightKg: 77.5 } }; d.training = { status: 'unavailable' };
    mockParams = { date: d.date, historyMonth: '2026-10' }; mockData = d; const v = wrap(<HistoryDayScreen />);
    expect(v.getByText('Cobertura parcial. Los datos disponibles siguen visibles.')).toBeTruthy(); expect(v.queryByTestId('global-day-empty')).toBeNull();
    expect(v.getByText('Peso: 77,5 kg')).toBeTruthy(); expect(v.getByText(/Consumo:/)).toBeTruthy();
    for (const [label, pathname] of [['Training','/(tabs)/train/day/[date]'], ['Nutrición','/(tabs)/nutrition'], ['Cuerpo','/(tabs)/progress/body'], ['Métricas','/(tabs)/progress/metrics']]) {
      fireEvent.press(v.getByRole('button', button(`Abrir ${label} del día`)));
      expect(mockNavigate).toHaveBeenLastCalledWith({ pathname, params: { date: d.date, historyDate: d.date, historyMonth: '2026-10' } });
    }
  });
  it('returns deterministically with validated dates, never arbitrary URLs', async () => {
    mockParams = { historyDate: '2026-09-03', historyMonth: '2026-09', returnUrl: 'https://other.test' }; const v = wrap(<ReturnToHistoryDay />);
    await act(async () => fireEvent.press(v.getByRole('button', button('Volver al día'))));
    expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/history/day/[date]', params: { date: '2026-09-03', historyMonth: '2026-09' } });
    expect(historyReturnParams({ historyDate: '2026-02-30', returnUrl: 'https://other.test' })).toBeUndefined();
  });
});
