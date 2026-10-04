import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';
import type { MobileApiClient } from '@/api/client';
import type { MobileApiReadResult } from '@/api/results';
import { useHistoryResource } from './use-history-resource';
import { useDomainDate } from './use-domain-date';
const mockClient = {} as MobileApiClient;
let mockUser = 'a', mockForeground: (next: AppStateStatus) => void;
jest.mock('@/api', () => ({ useMobileApi: () => ({ client: mockClient }) }));
jest.mock('@/auth', () => ({ useMobileAuth: () => ({ session: { user: { id: mockUser } } }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
const meta = { durationMs: 1, httpStatus: 200, outcome: 'ok' as const };
const ok = (data: string) => ({ status: 'ok' as const, data, meta });
const lost = { status: 'unavailable' as const, reason: 'network' as const, meta: { ...meta, httpStatus: null, outcome: 'unavailable' as const } };
beforeEach(() => { mockUser = 'a'; AppState.currentState = 'active'; jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { mockForeground = callback; return { remove: jest.fn() }; }); });
describe('M6 scoped resources', () => {
  it('never displays late responses from a previous date or user', async () => {
    let resolveOld!: (result: MobileApiReadResult<string>) => void;
    const old = jest.fn<(_: MobileApiClient, signal: AbortSignal) => Promise<MobileApiReadResult<string>>>(() => new Promise(resolve => { resolveOld = resolve; }));
    const fresh = jest.fn<(_: MobileApiClient, signal: AbortSignal) => Promise<MobileApiReadResult<string>>>().mockResolvedValue(ok('new-day'));
    const h = renderHook(({ scope, read }: { scope: string; read: typeof old }) => useHistoryResource(scope, read), { initialProps: { scope: 'day:old', read: old } });
    h.rerender({ scope: 'day:new', read: fresh }); await waitFor(() => expect(h.result.current.data).toBe('new-day'));
    await act(async () => { resolveOld(ok('old-day')); }); expect(h.result.current.data).toBe('new-day');
    mockUser = 'b'; fresh.mockImplementation(() => new Promise(() => {})); h.rerender({ scope: 'day:new', read: fresh });
    expect(h.result.current.data).toBeUndefined(); h.unmount();
  });
  it('keeps stale truth only for the same date and refreshes on foreground', async () => {
    const read = jest.fn<(_: MobileApiClient, signal: AbortSignal) => Promise<MobileApiReadResult<string>>>().mockResolvedValue(ok('date-1'));
    const h = renderHook(() => useHistoryResource('day:1', read)); await waitFor(() => expect(h.result.current.data).toBe('date-1'));
    read.mockResolvedValue(lost); await act(async () => { await h.result.current.refresh(); });
    expect(h.result.current.stale).toBe(true); expect(h.result.current.data).toBe('date-1');
    read.mockResolvedValue(ok('refreshed-date-1'));
    await act(async () => { mockForeground('background'); mockForeground('active'); });
    await waitFor(() => expect(h.result.current.data).toBe('refreshed-date-1')); h.unmount();
  });
  it('preserves locally selected domain date until route date changes', () => {
    const h = renderHook(({ date }: { date: string }) => useDomainDate(date), { initialProps: { date: '2026-09-01' } });
    act(() => h.result.current[1]('2026-09-02')); h.rerender({ date: '2026-09-01' }); expect(h.result.current[0]).toBe('2026-09-02');
    h.rerender({ date: '2026-08-01' }); expect(h.result.current[0]).toBe('2026-08-01');
  });
});
