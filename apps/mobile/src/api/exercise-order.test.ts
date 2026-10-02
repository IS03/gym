import { describe, expect, it, jest } from '@jest/globals';
import { createMobileApiClient, type MobileApiClient } from './client';
import { parseSessionExerciseOrder, reorderSessionExercises } from './active-session';
const sessionId = '11111111-1111-4111-8111-111111111111', first = '22222222-2222-4222-8222-222222222222', second = '33333333-3333-4333-8333-333333333333';
const version = '2026-10-01T12:00:00.123456+00:00';
const body = { orderedSessionExerciseIds: [second, first], expectedSessionUpdatedAt: version, idempotencyKey: 'same-intent' };
const response = { status: 'reordered', sessionId, sessionUpdatedAt: '2026-10-01T12:00:01.123457+00:00', orderedSessionExerciseIds: [second, first] };
function client(fetchImplementation: typeof fetch) { return createMobileApiClient({
  auth: { getAccessToken: async () => ({ status: 'ok', accessToken: 'token' }), revalidateAfterUnauthorized: async () => ({ status: 'invalid' }) },
  config: { appEnv: 'development', baseUrl: 'https://example.test', host: 'example.test', timeoutMs: 1000 }, fetchImplementation,
  runtime: { appVersion: '1', build: '1', platform: 'ios' }, telemetry: { record: () => undefined },
}); }
const reply = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }) as Response;
describe('M3.3D SDK exercise order (no drag UI)', () => {
  it('parses exact order/server CAS without rounding microseconds', () => {
    expect(parseSessionExerciseOrder(response)).toEqual(response);
    const upper='AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(parseSessionExerciseOrder({ ...response, orderedSessionExerciseIds: [upper] })?.orderedSessionExerciseIds).toEqual([upper.toLowerCase()]);
    expect(parseSessionExerciseOrder({ ...response, orderedSessionExerciseIds: [upper,upper.toLowerCase()] })).toBeUndefined();
    expect(parseSessionExerciseOrder({ ...response, orderedSessionExerciseIds: [] })?.orderedSessionExerciseIds).toEqual([]);
    for (const invalid of [{ ...response, sessionUpdatedAt: 'bad' }, { ...response, orderedSessionExerciseIds: [first, first] },
      { ...response, orderedSessionExerciseIds: [null] }, { ...response, userId: 'unexpected' }, { ...response, status: 'added' }]) expect(parseSessionExerciseOrder(invalid)).toBeUndefined();
  });
  it('sends one version-bound idempotent PUT and validates path association/server truth', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValue(reply(200, response));
    expect(await reorderSessionExercises(client(fetch), sessionId, body)).toMatchObject({ status: 'ok', data: response });
    expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe(`https://example.test/api/mobile/v1/training/sessions/${sessionId}/exercise-order`);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(body);
    for (const wrong of [{ ...response, sessionId: first }, { ...response, orderedSessionExerciseIds: [first, second] }]) {
      fetch.mockResolvedValue(reply(200, wrong)); expect(await reorderSessionExercises(client(fetch), sessionId, body)).toMatchObject({ status: 'unavailable', reason: 'invalid_response' });
    }
  });
  it('exposes explicit SESSION_CHANGED and never retries ambiguous writes', async () => {
    const fetch = jest.fn<typeof globalThis.fetch>().mockResolvedValueOnce(reply(409, { error: 'SESSION_CHANGED', message: 'stale' })).mockRejectedValueOnce(new Error('response lost'));
    const api = client(fetch);
    expect(await reorderSessionExercises(api, sessionId, body)).toMatchObject({ status: 'conflict', code: 'SESSION_CHANGED' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await reorderSessionExercises(api, sessionId, body)).toMatchObject({ status: 'unavailable', reason: 'network' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('keeps caller-owned replay keys and request arrays intact', async () => {
    const request = jest.fn<MobileApiClient['request']>().mockResolvedValue({ status: 'ok', data: response, meta: { durationMs: 0, httpStatus: 200, outcome: 'ok' } });
    const api = { request, read: jest.fn() } as MobileApiClient;
    await reorderSessionExercises(api, sessionId, body); await reorderSessionExercises(api, sessionId, body);
    expect(request.mock.calls[0][0].body).toEqual(request.mock.calls[1][0].body); expect(body.orderedSessionExerciseIds).toEqual([second, first]);
  });
});
