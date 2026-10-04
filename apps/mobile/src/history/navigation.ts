import { isNutritionDate } from '@/api/nutrition-day';
export type HistoryReturn = { historyDate: string; historyMonth?: string };
export function historyReturnParams(params: Record<string, unknown>): HistoryReturn | undefined {
  if (!isNutritionDate(params.historyDate)) return;
  return { historyDate: params.historyDate, ...(typeof params.historyMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.historyMonth)
    ? { historyMonth: params.historyMonth } : {}) };
}
export function historyDayHref(date: string, month?: string) {
  return { pathname: '/history/day/[date]' as const, params: { date, ...(month ? { historyMonth: month } : {}) } };
}
export function selectedRouteDate(params: Record<string, unknown>): string | null {
  return isNutritionDate(params.date) ? params.date : null;
}
