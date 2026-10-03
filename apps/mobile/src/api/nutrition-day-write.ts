import type { MobileApiClient } from './client';
import { parseDayWriteResponse, type DayWriteIntent } from '../../../../src/lib/mobile-api/nutrition-day-write-contract';
export { parseDayWriteIntent, parseDayWriteResponse } from '../../../../src/lib/mobile-api/nutrition-day-write-contract';
export type { DayWriteIntent, DayWriteResponse, DayWriteReceipt, MetricChange, OverrideChange } from '../../../../src/lib/mobile-api/nutrition-day-write-contract';
export function mutateNutritionDay(client: MobileApiClient, intent: DayWriteIntent, signal?: AbortSignal) {
  return client.request({ method: 'PATCH', path: `/api/mobile/v1/nutrition/days/${intent.date}/${intent.operation}`, body: intent, signal,
    parse: value => {
      const result = parseDayWriteResponse(value);
      return !result || 'error' in result ? result : result.date === intent.date && result.operation === intent.operation ? result : undefined;
    } });
}
