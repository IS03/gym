import { bodyRecord } from './body-contract';
import { parseBodyDay, parseSection, type BodyDay } from './body-day-contract';
import {
  isNutritionDate, parseNutritionDayActivity,
  type NutritionDayData, type NutritionDayMetric, type NutritionReadResult,
} from './nutrition-day-contract';

export const HISTORY_SOURCES = ['training', 'nutrition', 'weight', 'measurements', 'metrics'] as const;
export type HistorySource = typeof HISTORY_SOURCES[number];
export type HistoryFact = {
  date: string; completedSessionsCount: number | null; nutritionEntriesCount: number | null;
  hasExplicitOverrides: boolean | null; hasWeight: boolean | null;
  measurementsCount: number | null; metricValuesCount: number | null;
};
export type HistoryRange = {
  today: string; requestedRange: { from: string; to: string }; effectiveRange: { from: string; to: string };
  availability: Record<HistorySource, 'ok' | 'unavailable'>; days: HistoryFact[];
};
export type HistoryNutrition = Omit<Extract<NutritionDayData, { dayState: 'recorded' }>, 'meals'>
  | { dayState: 'missing'; summary: null; context: null };
export type HistoryDay = {
  date: string; today: string; discovery: HistoryRange | null;
  training: NutritionReadResult<{ sessions: { id: string; name: string }[] }>;
  activeSession: NutritionReadResult<{ id: string; name: string; logDate: string } | null>;
  nutrition: NutritionReadResult<HistoryNutrition>;
  body: BodyDay;
  metrics: NutritionReadResult<{ metrics: NutritionDayMetric[] }>;
};
const count = (v: unknown) => v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const timestamp = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const flag = (v: unknown) => v === null || typeof v === 'boolean';
export function shiftHistoryDate(date: string, offset: number): string {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
function range(v: unknown): v is { from: string; to: string } {
  return bodyRecord(v) && isNutritionDate(v.from) && isNutritionDate(v.to) && v.from <= v.to;
}
export function parseHistoryRange(v: unknown): HistoryRange | undefined {
  if (!bodyRecord(v) || !isNutritionDate(v.today) || !range(v.requestedRange) || !range(v.effectiveRange)
    || v.effectiveRange.from !== v.requestedRange.from || v.effectiveRange.to !== (v.requestedRange.to > v.today ? v.today : v.requestedRange.to)
    || !bodyRecord(v.availability) || !HISTORY_SOURCES.every(k => ['ok', 'unavailable'].includes(String((v.availability as Record<string, unknown>)[k])))
    || !Array.isArray(v.days) || v.days.length < 1 || v.days.length > 62) return;
  const days: HistoryFact[] = [];
  for (const d of v.days) {
    if (!bodyRecord(d) || !isNutritionDate(d.date) || d.date !== shiftHistoryDate(v.effectiveRange.from, days.length)
      || ![d.completedSessionsCount, d.nutritionEntriesCount, d.measurementsCount, d.metricValuesCount].every(count)
      || ![d.hasWeight, d.hasExplicitOverrides].every(flag)) return;
    const fields: Record<HistorySource, string[]> = { training: ['completedSessionsCount'], nutrition: ['nutritionEntriesCount', 'hasExplicitOverrides'],
      weight: ['hasWeight'], measurements: ['measurementsCount'], metrics: ['metricValuesCount'] };
    if (HISTORY_SOURCES.some(k => fields[k].some(f => (d[f] === null) !== ((v.availability as Record<string, unknown>)[k] === 'unavailable')))) return;
    days.push({ date: d.date, completedSessionsCount: d.completedSessionsCount as number | null,
      nutritionEntriesCount: d.nutritionEntriesCount as number | null, hasExplicitOverrides: d.hasExplicitOverrides as boolean | null,
      hasWeight: d.hasWeight as boolean | null, measurementsCount: d.measurementsCount as number | null, metricValuesCount: d.metricValuesCount as number | null });
  }
  if (days.at(-1)?.date !== v.effectiveRange.to || shiftHistoryDate(v.requestedRange.from, 61) < v.requestedRange.to) return;
  return { today: v.today, requestedRange: { from: v.requestedRange.from, to: v.requestedRange.to },
    effectiveRange: { from: v.effectiveRange.from, to: v.effectiveRange.to },
    availability: Object.fromEntries(HISTORY_SOURCES.map(k => [k, (v.availability as HistoryRange['availability'])[k]])) as HistoryRange['availability'], days };
}
/** true = a confirmed fact, false = confirmed empty, null = incomplete coverage. */
export function historyHasActivity(d: HistoryFact): boolean | null {
  if ([d.completedSessionsCount, d.nutritionEntriesCount, d.measurementsCount, d.metricValuesCount].some(n => n !== null && n > 0)
    || d.hasWeight === true || d.hasExplicitOverrides === true) return true;
  return Object.values(d).some(x => x === null) ? null : false;
}
export function historyDomainLabels(d: HistoryFact): string[] {
  return [d.completedSessionsCount !== null && d.completedSessionsCount > 0 ? 'Training' : null,
    (d.nutritionEntriesCount !== null && d.nutritionEntriesCount > 0) || d.hasExplicitOverrides ? 'Nutrición' : null,
    d.hasWeight || (d.measurementsCount !== null && d.measurementsCount > 0) ? 'Cuerpo' : null,
    d.metricValuesCount !== null && d.metricValuesCount > 0 ? 'Métricas' : null].filter((x): x is string => !!x);
}
export function parseHistoryDay(v: unknown): HistoryDay | undefined {
  if (!bodyRecord(v) || !isNutritionDate(v.date) || !isNutritionDate(v.today) || v.date > v.today) return;
  const discovery = v.discovery === null ? null : parseHistoryRange(v.discovery);
  if (discovery === undefined || (discovery && (discovery.days.length !== 1 || discovery.days[0].date !== v.date || discovery.today !== v.today))) return;
  const training = parseSection(v.training, x => {
    if (!bodyRecord(x) || !Array.isArray(x.sessions) || x.sessions.length > 3
      || !x.sessions.every(s => bodyRecord(s) && uuid(s.id) && typeof s.name === 'string')) return;
    return { sessions: x.sessions.map(s => ({ id: s.id as string, name: s.name as string })) };
  });
  const activeSession = parseSection(v.activeSession, x => x === null ? null
    : bodyRecord(x) && uuid(x.id) && typeof x.name === 'string' && x.logDate === v.date
      ? { id: x.id, name: x.name, logDate: v.date as string } : undefined);
  const nutrition = parseSection(v.nutrition, x => {
    if (!bodyRecord(x)) return;
    if (x.dayState === 'missing') return x.summary === null && x.context === null ? x as HistoryNutrition : undefined;
    if (x.dayState !== 'recorded' || !bodyRecord(x.summary) || !Number.isSafeInteger(x.summary.entryCount) || Number(x.summary.entryCount) < 0) return;
    const s = x.summary;
    if (s.mealCount === null || !count(s.mealCount) || Number(s.mealCount) > Number(s.entryCount)
      || !['calories','proteinG','carbsG','fatG'].every(k => {
        const n = s[k]; return bodyRecord(n) && typeof n.knownTotal === 'number' && Number.isFinite(n.knownTotal) && n.knownTotal >= 0
          && n.missingCount !== null && count(n.missingCount) && Number(n.missingCount) <= Number(s.entryCount);
      }) || !bodyRecord(x.context)) return;
    const c = x.context;
    if (!['calorieTarget','proteinTargetG','waterTargetL','expenditureKcal','targetAutomaticKcal','targetOverrideKcal','expenditureAutomaticKcal','expenditureOverrideKcal']
      .every(k => c[k] === null || (typeof c[k] === 'number' && Number.isFinite(c[k]) && c[k] >= 0))
      || !['deltaVsTargetKcal','energyBalanceKcal'].every(k => c[k] === null || (typeof c[k] === 'number' && Number.isFinite(c[k])))
      || !(c.resolvedAt === null || timestamp(c.resolvedAt)) || (c.updatedAt !== undefined && !timestamp(c.updatedAt))
      || !bodyRecord(c.training) || !flag(c.training.effective) || !['workout','override','none',null].includes(c.training.source as string | null)
      || !bodyRecord(c.work) || !flag(c.work.effective) || !['schedule','override',null].includes(c.work.source as string | null)) return;
    return x as HistoryNutrition;
  });
  const body = parseBodyDay(v.body), metrics = parseSection(v.metrics, parseNutritionDayActivity);
  if (!training || !activeSession || !nutrition || !body || body.date !== v.date || body.today !== v.today || !metrics) return;
  return { date: v.date, today: v.today, discovery, training, activeSession, nutrition, body, metrics };
}
