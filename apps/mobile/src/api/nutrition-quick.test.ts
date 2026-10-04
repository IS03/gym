import { describe, expect, it, jest } from '@jest/globals';
import { createMobileApiClient } from './client';
import { confirmQuickMeal, previewQuickMeal, fetchQuickOptions, parseQuickOptions } from './nutrition-quick';
import { quickDate, quickOption, quickOptions, quickPreview, quickReceipt } from '@/nutrition/quick-fixture.test-helper';
const response = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }) as Response;
function client(fetchImplementation: typeof fetch) { return createMobileApiClient({ auth: { getAccessToken: async () => ({ status: 'ok', accessToken: 'token' }), revalidateAfterUnauthorized: async () => ({ status: 'invalid' }) },
  config: { appEnv: 'development', baseUrl: 'https://example.test', host: 'example.test', timeoutMs: 1000 }, fetchImplementation,
  runtime: { appVersion: '1', build: '1', platform: 'ios' }, telemetry: { record: () => {} } }); }
const selection = { date: quickDate, source: quickOption().source, quantities: null };
const intent = { ...selection, operation: 'register' as const, idempotencyKey: 'key' };
describe('Quick API', () => {
  it('parses independent empty/unavailable sections and rejects invalid source metadata', () => {
    expect(parseQuickOptions({ ...quickOptions(), saved: { status: 'unavailable' }, suggested: { status: 'ok', items: [] } })).toMatchObject({ saved: { status: 'unavailable' }, suggested: { items: [] } });
    expect(parseQuickOptions({ ...quickOptions(), saved: { status: 'ok', items: [{ ...quickOption(), source: { ...quickOption().source, version: 'old' } }] } })).toBeUndefined();
  });
  it('sends source/version/date/quantities only and never blindly retries a write', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('lost'));
    expect((await confirmQuickMeal(client(fetch), intent)).status).toBe('unavailable'); expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(intent);
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer token' });
  });
  it('correlates preview/receipt with the request and recognizes source conflicts', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValueOnce(response(200, quickPreview(selection)))
      .mockResolvedValueOnce(response(200, quickPreview({ ...selection, date: '2026-09-01' })))
      .mockResolvedValueOnce(response(201, { ...quickReceipt, operation: 'saveSuggestion', status: 'habitual_saved' }))
      .mockResolvedValueOnce(response(409, { error: 'QUICK_SOURCE_CHANGED', message: 'changed' }))
      .mockResolvedValueOnce(response(200, quickOptions()));
    const api = client(fetch); expect((await previewQuickMeal(api, selection)).status).toBe('ok');
    expect((await previewQuickMeal(api, selection)).status).toBe('unavailable'); expect((await confirmQuickMeal(api, intent)).status).toBe('unavailable');
    expect((await confirmQuickMeal(api, intent)).status).toBe('conflict'); expect((await fetchQuickOptions(api)).status).toBe('ok');
  });
});
