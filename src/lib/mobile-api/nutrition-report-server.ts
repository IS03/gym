import 'server-only';
import { todayInCordoba } from '../phase2/cordoba-date';
import { resolveNutritionReportRange } from '../nutrition/reports-core';
import { MobileApiValidationError } from './auth';
import { isNutritionDate } from './nutrition-day-contract';
import { parseReportQuery } from './nutrition-report-contract';
import { buildMobileNutritionReport, parseNutritionReportFacts } from './nutrition-report';
import type { MobileSupabaseAuthenticatedContext } from './supabase';

export async function readMobileNutritionReport(params: URLSearchParams, context: MobileSupabaseAuthenticatedContext) {
  const input: Record<string,string> = {};
  for (const [key,value] of params) {
    if (key in input) throw new MobileApiValidationError('Parámetro repetido.');
    input[key]=value;
  }
  const query=parseReportQuery({period:'7',...input});
  if (!query) throw new MobileApiValidationError('Período no válido.');
  let today=todayInCordoba();
  // One bounded retry of a READ coordinates a server-midnight boundary without
  // duplicating the canonical calendar resolver inside Postgres.
  for(let attempt=0;attempt<2;attempt++) {
    const range=resolveNutritionReportRange(query,today);
    const {data,error}=await context.supabase.rpc('mobile_read_nutrition_report',{p_start:range.start,p_end:range.end,p_expected_today:today},{get:true});
    if(error || !data || typeof data!=='object' || Array.isArray(data)) throw new Error('Report snapshot unavailable');
    if(data.status==='day_changed'&&isNutritionDate(data.today)) {today=data.today;continue;}
    if(data.status!=='ok'||data.today!==today||data.start!==range.start||data.end!==range.end) throw new Error('Report snapshot unavailable');
    const facts=parseNutritionReportFacts(data);
    if(!facts) throw new Error('Report snapshot invalid');
    return buildMobileNutritionReport(query,range,today,facts);
  }
  throw new Error('Report date changed');
}
