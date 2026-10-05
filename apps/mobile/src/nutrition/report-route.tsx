import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseReportQuery } from '@/api/nutrition-report';
import { NutritionReportsContent } from './report-screen';

/** /(tabs)/nutrition/reports: the same Reports component, deep-linkable from Progress with its period. */
export function NutritionReportsRoute() {
  const router = useRouter();
  const p = useLocalSearchParams<{ period?: string; from?: string; to?: string }>();
  const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  const period = one(p.period);
  const initialQuery = parseReportQuery(period === 'custom' ? { period, from: one(p.from), to: one(p.to) } : period ? { period } : { period: '7' }) ?? { period: '7' };
  return <NutritionReportsContent initialQuery={initialQuery} onDate={date => router.push({ pathname: '/history/day/[date]', params: { date } })} />;
}
