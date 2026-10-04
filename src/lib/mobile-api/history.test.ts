import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./supabase', () => ({ authenticateMobileAccessToken: vi.fn() }));
vi.mock('../phase2/training-robust', () => ({ listCompletedSessionHistory: vi.fn(), sessionDisplayName: () => 'Activa' }));
vi.mock('../phase2/training', () => ({ getInProgressSessionForUser: vi.fn() }));
vi.mock('../phase2/cordoba-date', () => ({ todayInCordoba: () => '2026-10-04' }));
import { listCompletedSessionHistory } from '../phase2/training-robust';
import { getInProgressSessionForUser } from '../phase2/training';
import { authenticateMobileAccessToken, type MobileSupabaseAuthenticatedContext } from './supabase';
import { historyReadResponse, readHistoryDay, readHistoryRange, readBodyDay, readBodyMeasurement } from './history-server';
import { historyHasActivity, parseHistoryDay, parseHistoryRange, shiftHistoryDate } from './history-contract';
import { historyDay, historyFact, historyId, historyRange, historyToday } from './history-fixture.test-helper';
import { MobileApiUnauthorizedError } from './auth';
const auth = (rpc: unknown) => ({ userId: historyId(1), supabase: { rpc } }) as MobileSupabaseAuthenticatedContext;
const rawNutrition = () => ({ date: historyToday, today: historyToday, nutrition: { status: 'ok', data: { dayLog: null, meals: [] } }, activity: { status: 'ok', data: { metrics: [] } } });

describe('M6 portable history contracts', () => {
  it.each(['completedSessionsCount','nutritionEntriesCount','measurementsCount','metricValuesCount'] as const)('discovers facts using %s and distinguishes unknown', field => {
    expect(historyHasActivity(historyFact())).toBe(false);
    expect(historyHasActivity(historyFact(historyToday, { [field]: 1 }))).toBe(true);
    expect(historyHasActivity(historyFact(historyToday, { [field]: null }))).toBeNull();
  });
  it('accepts override-only, weight-only and rejects unknown counts becoming zeros', () => {
    expect(historyHasActivity(historyFact(historyToday, { hasExplicitOverrides: true }))).toBe(true);
    expect(historyHasActivity(historyFact(historyToday, { hasWeight: true }))).toBe(true);
    const r = historyRange(); r.availability.training = 'unavailable';
    expect(parseHistoryRange(r)).toBeUndefined(); r.days[0].completedSessionsCount = null;
    expect(parseHistoryRange(r)).toEqual(r);
  });
  it('validates dense bounded ranges, civil date navigation and requested/effective trimming', () => {
    expect(shiftHistoryDate('2024-02-28', 1)).toBe('2024-02-29');
    const r = historyRange([historyFact('2026-10-03'), historyFact()]); r.requestedRange.to = '2026-10-06';
    expect(parseHistoryRange(r)).toEqual(r);
    r.days[0].date = '2026-10-02'; expect(parseHistoryRange(r)).toBeUndefined();
    expect(parseHistoryRange({ ...historyRange(), requestedRange: { from: '2026-01-01', to: historyToday } })).toBeUndefined();
  });
  it('rejects mixed dates, oversized previews, body from another day and future dates', () => {
    const d = historyDay(); expect(parseHistoryDay(d)).toEqual(d);
    expect(parseHistoryDay({ ...d, date: '2026-10-05' })).toBeUndefined();
    expect(parseHistoryDay({ ...d, body: { ...d.body, date: '2026-10-03' } })).toBeUndefined();
    d.training = { status: 'ok', data: { sessions: Array.from({ length: 4 }, (_, i) => ({ id: historyId(i), name: 'Sesión' })) } };
    expect(parseHistoryDay(d)).toBeUndefined();
  });
});
describe('M6 read server', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(listCompletedSessionHistory).mockResolvedValue([]); vi.mocked(getInProgressSessionForUser).mockResolvedValue(null); });
  it.each(['from=2026-10-01','to=2026-10-04','from=2026-01-01&to=2026-10-04','from=2026-10-04&to=2026-10-01','userId=other','from=2026-02-30&to=2026-10-04','from=2026-10-01&from=2026-10-02&to=2026-10-04'])('rejects %s before database read', async query => {
    const rpc = vi.fn(); await expect(readHistoryRange(new URLSearchParams(query), auth(rpc))).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
  });
  it('calls one bounded owner-scoped RPC and preserves partial availability', async () => {
    const r = historyRange(); r.availability.metrics = 'unavailable'; r.days[0].metricValuesCount = null;
    const rpc = vi.fn().mockResolvedValue({ data: r, error: null });
    expect(await readHistoryRange(new URLSearchParams(), auth(rpc))).toEqual(r);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('mobile_read_history_range', { p_from: null, p_to: null });
  });
  it('composes independent day reads with total above preview, active log date and no definition initialization', async () => {
    const r = historyRange([historyFact(historyToday, { completedSessionsCount: 1002 })]);
    const d = historyDay();
    const rpc = vi.fn(async (name: string) => ({ data: name === 'mobile_read_history_range' ? r : name === 'mobile_read_body_day' ? d.body : rawNutrition(), error: null }));
    vi.mocked(listCompletedSessionHistory).mockResolvedValue([{ id: historyId(2), routineName: 'Piernas' }] as Awaited<ReturnType<typeof listCompletedSessionHistory>>);
    vi.mocked(getInProgressSessionForUser).mockResolvedValue({ log_date: historyToday, session: { id: historyId(3) } } as Awaited<ReturnType<typeof getInProgressSessionForUser>>);
    const result = await readHistoryDay(historyToday, auth(rpc));
    expect(result.discovery?.days[0].completedSessionsCount).toBe(1002);
    expect(result.training).toMatchObject({ data: { sessions: [{ name: 'Piernas' }] } });
    expect(result.activeSession).toMatchObject({ data: { logDate: historyToday } });
    expect(rpc.mock.calls.map(c => c[0])).not.toContain('ensure_user_metrics');
    expect(parseHistoryDay(result)).toEqual(result);
    expect(listCompletedSessionHistory).toHaveBeenCalledWith({ logDate: historyToday, limit: 3 }, expect.objectContaining({ userId: historyId(1) }));
  });
  it('keeps Body/metrics when Training fails and does not relocate a cross-midnight active session', async () => {
    vi.mocked(listCompletedSessionHistory).mockRejectedValue(new Error('network'));
    vi.mocked(getInProgressSessionForUser).mockResolvedValue({ log_date: '2026-10-03', session: { id: historyId(3) } } as Awaited<ReturnType<typeof getInProgressSessionForUser>>);
    const rpc = vi.fn(async (name: string) => ({ data: name === 'mobile_read_history_range' ? historyRange() : name === 'mobile_read_body_day' ? historyDay().body : rawNutrition(), error: null }));
    const result = await readHistoryDay(historyToday, auth(rpc));
    expect(result.training.status).toBe('unavailable'); expect(result.metrics.status).toBe('ok'); expect(result.body.weight.status).toBe('ok'); expect(result.activeSession).toEqual({ status: 'ok', data: null });
  });
  it('exact Body date rejects a latest-weight substitute; identity absence is confirmed 404', async () => {
    const d = historyDay().body; d.weight = { status: 'ok', data: { date: '2026-10-03', weightKg: 80 } };
    await expect(readBodyDay(historyToday, auth(vi.fn().mockResolvedValue({ data: d, error: null })))).rejects.toThrow();
    await expect(readBodyMeasurement(historyId(1), auth(vi.fn().mockResolvedValue({ data: null, error: null })))).rejects.toThrow();
  });
  it('rejects future before domain reads and unauthenticated HTTP requests before any read', async () => {
    const rpc = vi.fn(); await expect(readHistoryDay('2026-10-05', auth(rpc))).rejects.toThrow(); expect(rpc).not.toHaveBeenCalled();
    const read = vi.fn(); const response = await historyReadResponse(new Request('https://ownlevel.test/api/mobile/v1/history/calendar'), read);
    expect(response.status).toBe(401); expect(read).not.toHaveBeenCalled(); expect(response.headers.get('cache-control')).toBe('no-store');
    vi.mocked(authenticateMobileAccessToken).mockRejectedValue(new MobileApiUnauthorizedError());
  });
});
