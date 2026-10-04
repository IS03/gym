import 'server-only';
import { NextResponse } from 'next/server';
import { MobileApiNotFoundError, MobileApiUnauthorizedError, MobileApiValidationError, mobileBearerToken } from './auth';
import { parseBodyMeasurement } from './body-contract';
import { parseMobileTrainingId } from './training';
import { authenticateMobileAccessToken, type MobileSupabaseAuthenticatedContext } from './supabase';
import { mobileApiResponseHeaders } from './http';
import { parseNutritionDate } from './nutrition-day';
import { readMobileNutritionDaySnapshot } from './nutrition-day-server';
import { parseBodyDay, type BodyDay } from './body-day-contract';
import { HISTORY_SOURCES, parseHistoryRange, type HistoryDay, type HistoryRange } from './history-contract';
import type { NutritionReadResult } from './nutrition-day-contract';
import { todayInCordoba } from '../phase2/cordoba-date';
import { listCompletedSessionHistory, sessionDisplayName } from '../phase2/training-robust';
import { getInProgressSessionForUser } from '../phase2/training';
import { measurePerformance, type RequestPerformanceContext } from '../request-performance';

const unavailable = { status: 'unavailable' } as const;
async function section<T>(read: () => Promise<T>): Promise<NutritionReadResult<T>> {
  try { return { status: 'ok', data: await read() }; }
  catch { return unavailable; }
}
export async function readHistoryRange(params: URLSearchParams, auth: MobileSupabaseAuthenticatedContext): Promise<HistoryRange> {
  if ([...params.keys()].some(k => !['from', 'to'].includes(k)) || params.getAll('from').length > 1 || params.getAll('to').length > 1
    || params.has('from') !== params.has('to')) throw new MobileApiValidationError('Enviá from y to juntos.');
  const from = params.has('from') ? parseNutritionDate(params.get('from')) : null;
  const to = params.has('to') ? parseNutritionDate(params.get('to')) : null;
  if (from && to && (from > to || (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000 + 1 > 62)) {
    throw new MobileApiValidationError('El rango debe tener hasta 62 días.');
  }
  const result = await measurePerformance({ route: '/api/mobile/v1/history/calendar', operation: 'mobile.history.range', layer: 'database' },
    () => auth.supabase.rpc('mobile_read_history_range', { p_from: from, p_to: to }));
  if (result.error?.code === '22023') throw new MobileApiValidationError('El rango no es válido o es futuro.');
  const data = result.error ? undefined : parseHistoryRange(result.data);
  if (!data || HISTORY_SOURCES.every(k => data.availability[k] === 'unavailable')) throw new Error('History range unavailable');
  return data;
}
export async function readBodyDay(date: string, auth: MobileSupabaseAuthenticatedContext): Promise<BodyDay> {
  parseNutritionDate(date);
  const result = await measurePerformance({ route: '/api/mobile/v1/body/days/[date]', operation: 'mobile.body.exact-date', layer: 'database' },
    () => auth.supabase.rpc('mobile_read_body_day', { p_date: date }));
  if (result.error?.code === '22023') throw new MobileApiValidationError('La fecha no es válida o es futura.');
  const dto = result.error ? undefined : parseBodyDay(result.data);
  if (!dto || (dto.weight.status === 'unavailable' && dto.measurement.status === 'unavailable')) throw new Error('Body date unavailable');
  return dto;
}
export async function readBodyMeasurement(id: string, auth: MobileSupabaseAuthenticatedContext) {
  const measurementId = parseMobileTrainingId(id, 'La medición');
  const { data, error } = await auth.supabase.rpc('mobile_read_body_measurement', { p_id: measurementId });
  if (error) throw new Error('Body measurement unavailable');
  if (data === null) throw new MobileApiNotFoundError();
  const measurement = parseBodyMeasurement(data);
  if (!measurement || measurement.id !== measurementId.toLowerCase()) throw new Error('Body measurement invalid');
  return measurement;
}
export async function readHistoryDay(date: string, auth: MobileSupabaseAuthenticatedContext, performance: RequestPerformanceContext = { requestKind: 'navigation' }): Promise<HistoryDay> {
  parseNutritionDate(date);
  const today = todayInCordoba();
  if (date > today) throw new MobileApiValidationError('Elegí una fecha hasta hoy.');
  const context = { supabase: auth.supabase, userId: auth.userId, requestPerformance: performance };
  const [range, training, activeSession, nutrition, body] = await Promise.all([
    section(() => readHistoryRange(new URLSearchParams({ from: date, to: date }), auth)),
    section(async () => ({ sessions: (await listCompletedSessionHistory({ logDate: date, limit: 3 }, context)).map(s => ({ id: s.id, name: s.routineName })) })),
    section(async () => {
      const active = await getInProgressSessionForUser(context);
      return active?.log_date === date ? { id: active.session.id, name: sessionDisplayName(active.session), logDate: active.log_date } : null;
    }),
    section(() => readMobileNutritionDaySnapshot(date, auth, performance)),
    section(() => readBodyDay(date, auth)),
  ]);
  const nutritionSection = nutrition.status === 'ok' ? nutrition.data.nutrition : unavailable;
  const metrics = nutrition.status === 'ok' ? nutrition.data.activity : unavailable;
  const projectedNutrition = nutritionSection.status === 'ok'
    ? { status: 'ok' as const, data: { dayState: nutritionSection.data.dayState, summary: nutritionSection.data.summary, context: nutritionSection.data.context } }
    : unavailable;
  if ([range, training, nutrition, body].every(s => s.status === 'unavailable') && (activeSession.status !== 'ok' || !activeSession.data)) throw new Error('History day unavailable');
  // Independent reads can cross Córdoba midnight. Align temporal metadata using
  // the same server clock; preserve the selected date and every domain snapshot.
  const serverToday = todayInCordoba();
  return { date, today: serverToday,
    discovery: range.status === 'ok' ? { ...range.data, today: serverToday } : null, training, activeSession,
    nutrition: projectedNutrition as HistoryDay['nutrition'], metrics,
    body: body.status === 'ok' ? { ...body.data, today: serverToday } : { date, today: serverToday, weight: unavailable, measurement: unavailable } };
}
export async function historyReadResponse(request: Request, read: (auth: MobileSupabaseAuthenticatedContext) => Promise<unknown>) {
  let status = 503, body: unknown = { error: 'DATA_UNAVAILABLE' };
  try {
    const auth = await authenticateMobileAccessToken(mobileBearerToken(request.headers.get('authorization')));
    body = await read(auth); status = 200;
  } catch (e) {
    if (e instanceof MobileApiUnauthorizedError) { status = 401; body = { error: 'UNAUTHORIZED' }; }
    else if (e instanceof MobileApiValidationError) { status = 400; body = { error: 'VALIDATION_ERROR', message: e.message }; }
    else if (e instanceof MobileApiNotFoundError) { status = 404; body = { error: 'NOT_FOUND' }; }
    else console.warn('[mobile.history] read unavailable');
  }
  return NextResponse.json(body, { status, headers: mobileApiResponseHeaders(request) });
}
