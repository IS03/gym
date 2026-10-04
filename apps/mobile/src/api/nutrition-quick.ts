import type { MobileApiClient } from './client';
import { parseQuickOptions, parseQuickPreview, parseQuickResponse, sameQuickSelection, type QuickSelection, type QuickIntent } from '../../../../src/lib/mobile-api/nutrition-quick-contract';
export * from '../../../../src/lib/mobile-api/nutrition-quick-contract';
export function fetchQuickOptions(client: MobileApiClient, signal?: AbortSignal) {
  return client.read({ path: '/api/mobile/v1/nutrition/quick-options', signal, parse: parseQuickOptions });
}
export function previewQuickMeal(client: MobileApiClient, selection: QuickSelection, signal?: AbortSignal) {
  return client.request({ method: 'POST', path: `/api/mobile/v1/nutrition/days/${selection.date}/meal-preview`, body: selection, signal,
    parse: v => { const p = parseQuickPreview(v); return p && sameQuickSelection(p.selection, selection) ? p : undefined; } });
}
export function confirmQuickMeal(client: MobileApiClient, intent: QuickIntent, signal?: AbortSignal) {
  return client.request({ method: 'POST', path: `/api/mobile/v1/nutrition/days/${intent.date}/meal-registrations`, body: intent, signal,
    parse: v => { const r = parseQuickResponse(v); return !r || 'error' in r ? r : r.date === intent.date && r.operation === intent.operation ? r : undefined; } });
}
