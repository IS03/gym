import { isNutritionDate } from './nutrition-day-contract';

export const REPORT_PRESETS = ['7', '14', '30', '3m', '6m', '1y', 'custom'] as const;
export type ReportPreset = typeof REPORT_PRESETS[number];
export type ReportQuery = { period: ReportPreset; from?: string; to?: string };
export const REPORT_METRICS = ['calories', 'targetCalories', 'targetDeviation', 'expenditure', 'balance', 'protein', 'targetProtein', 'carbs', 'fat'] as const;
export type ReportMetric = typeof REPORT_METRICS[number];
export const REPORT_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const;
export type ReportNutrient = typeof REPORT_NUTRIENTS[number];
export type ReportStatistic = { value: number | null; denominator: number; partialDays: number };
export type ReportNutrientValue = { value: number | null; knownMeals: number; missingMeals: number; status: 'none' | 'unknown' | 'partial' | 'complete' };
export type ReportDailyRow = {
  date: string; exists: boolean; hasNutrition: boolean; imported: boolean; isToday: boolean; mealCount: number;
  nutrients: Record<ReportNutrient, ReportNutrientValue>;
  targetCalories: number | null; targetProteinG: number | null; expenditureKcal: number | null;
  targetDeviationKcal: number | null; energyBalanceKcal: number | null; goalStage: string | null;
};
export type NutritionReport = {
  today: string;
  range: { requested: ReportQuery; preset: ReportPreset; start: string; end: string; days: number; notice: string | null };
  status: 'empty' | 'partial' | 'complete';
  summary: { metrics: Record<ReportMetric, ReportStatistic>; accumulatedBalance: ReportStatistic;
    belowTargetDays: number; exactTargetDays: number; aboveTargetDays: number;
    deficitDays: number; neutralDays: number; surplusDays: number; proteinHitDays: number; proteinComparableDays: number; goalStages: string[] };
  coverage: { registeredDays: number; completedRegisteredDays: number; finalizedDays: number; missingDays: number; todayRegistered: boolean;
    nutrients: Record<ReportNutrient, { knownDays: number; partialDays: number; unknownDays: number }> };
  evolution: { start: string; end: string; includesToday: boolean; metrics: Record<ReportMetric, ReportStatistic> }[];
  highlights: { date: string; kind: 'closest_target' | 'largest_balance' | 'highest_protein'; title: string }[];
  days: ReportDailyRow[];
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const number = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v));
export function parseReportQuery(v: unknown): ReportQuery | undefined {
  if (!record(v) || !REPORT_PRESETS.includes(v.period as ReportPreset) || Object.keys(v).some(k => !['period','from','to'].includes(k))) return;
  if (v.period === 'custom') {
    if (typeof v.from !== 'string' || typeof v.to !== 'string') return;
  } else if (v.from !== undefined || v.to !== undefined) return;
  return v as ReportQuery;
}
const statistic = (v: unknown) => record(v) && number(v.value) && count(v.denominator) && count(v.partialDays)
  && v.partialDays <= v.denominator && (v.denominator === 0 ? v.value === null : v.value !== null);
const metrics = (v: unknown) => record(v) && REPORT_METRICS.every(k => statistic(v[k]));
export function parseNutritionReport(v: unknown): NutritionReport | undefined {
  if (!record(v) || !isNutritionDate(v.today) || !['empty','partial','complete'].includes(String(v.status)) || !record(v.range)) return;
  const r = v.range;
  if (!parseReportQuery(r.requested) || !REPORT_PRESETS.includes(r.preset as ReportPreset) || !isNutritionDate(r.start) || !isNutritionDate(r.end)
    || r.start > r.end || r.end > v.today || !count(r.days) || r.days < 1 || r.days > 366
    || r.days !== Math.round((Date.parse(r.end)-Date.parse(r.start))/86400000)+1 || (r.notice !== null && typeof r.notice !== 'string')) return;
  if (!record(v.summary) || !metrics(v.summary.metrics) || !statistic(v.summary.accumulatedBalance)
    || !['belowTargetDays','exactTargetDays','aboveTargetDays','deficitDays','neutralDays','surplusDays','proteinHitDays','proteinComparableDays'].every(k => count((v.summary as Record<string,unknown>)[k]))
    || !Array.isArray(v.summary.goalStages) || !v.summary.goalStages.every(s => typeof s === 'string')) return;
  if (!record(v.coverage) || !['registeredDays','completedRegisteredDays','finalizedDays','missingDays'].every(k => count((v.coverage as Record<string,unknown>)[k]))
    || typeof v.coverage.todayRegistered !== 'boolean' || !record(v.coverage.nutrients)
    || !REPORT_NUTRIENTS.every(k => { const n = (v.coverage as {nutrients: Record<string,unknown>}).nutrients[k]; return record(n) && count(n.knownDays) && count(n.partialDays) && count(n.unknownDays) && n.partialDays <= n.knownDays; })) return;
  if (!Array.isArray(v.days) || v.days.length !== r.days || !v.days.every((d, i) => {
    if (!record(d) || !isNutritionDate(d.date) || d.date !== new Date(Date.parse(r.end as string)-i*86400000).toISOString().slice(0,10)
      || !['exists','hasNutrition','imported','isToday'].every(k => typeof d[k] === 'boolean') || d.isToday !== (d.date === v.today)
      || !count(d.mealCount) || !record(d.nutrients) || !['targetCalories','targetProteinG','expenditureKcal','targetDeviationKcal','energyBalanceKcal'].every(k => number(d[k]))
      || (d.goalStage !== null && typeof d.goalStage !== 'string')) return false;
    return REPORT_NUTRIENTS.every(k => {
      const n = (d.nutrients as Record<string,unknown>)[k];
      if (!record(n) || !number(n.value) || !count(n.knownMeals) || !count(n.missingMeals) || n.knownMeals+n.missingMeals !== d.mealCount) return false;
      const status = d.mealCount === 0 ? 'none' : n.knownMeals === 0 ? 'unknown' : n.missingMeals > 0 ? 'partial' : 'complete';
      return n.status === status && (n.knownMeals === 0 ? n.value === null : n.value !== null);
    });
  })) return;
  if (!Array.isArray(v.evolution) || v.evolution.length < 1 || v.evolution.length > 31 || !v.evolution.every((b,i) => record(b)
    && isNutritionDate(b.start) && isNutritionDate(b.end) && b.start <= b.end && b.start >= (r.start as string) && b.end <= (r.end as string)
    && typeof b.includesToday === 'boolean' && b.includesToday === (b.start <= (v.today as string) && b.end >= (v.today as string)) && metrics(b.metrics)
    && (i === 0 ? b.start === r.start : Date.parse(b.start)-Date.parse((v.evolution as {end:string}[])[i-1]!.end) === 86400000))) return;
  if ((v.evolution[v.evolution.length-1] as {end:string}).end !== r.end) return;
  if (!Array.isArray(v.highlights) || v.highlights.length > 3 || !v.highlights.every(h => record(h) && isNutritionDate(h.date)
    && h.date >= (r.start as string) && h.date < (v.today as string) && h.date <= (r.end as string)
    && ['closest_target','largest_balance','highest_protein'].includes(String(h.kind)) && typeof h.title === 'string')) return;
  return v as NutritionReport;
}
