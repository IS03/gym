import type { HistoryDay, HistoryFact, HistoryRange } from './history-contract';
export const historyToday = '2026-10-04';
export const historyId = (n: number) => `61000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function historyFact(date = historyToday, patch: Partial<HistoryFact> = {}): HistoryFact {
  return { date, completedSessionsCount: 0, nutritionEntriesCount: 0, hasExplicitOverrides: false,
    hasWeight: false, measurementsCount: 0, metricValuesCount: 0, ...patch };
}
export function historyRange(days = [historyFact()]): HistoryRange {
  return { today: historyToday, requestedRange: { from: days[0].date, to: days.at(-1)!.date },
    effectiveRange: { from: days[0].date, to: days.at(-1)!.date },
    availability: { training: 'ok', nutrition: 'ok', weight: 'ok', measurements: 'ok', metrics: 'ok' }, days };
}
export function historyDay(date = historyToday): HistoryDay {
  return { date, today: historyToday, discovery: historyRange([historyFact(date)]),
    training: { status: 'ok', data: { sessions: [] } }, activeSession: { status: 'ok', data: null },
    nutrition: { status: 'ok', data: { dayState: 'missing', summary: null, context: null } },
    body: { date, today: historyToday, weight: { status: 'ok', data: null }, measurement: { status: 'ok', data: null } },
    metrics: { status: 'ok', data: { metrics: [] } } };
}
