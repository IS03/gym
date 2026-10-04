import { describe, expect, it, vi } from 'vitest';
import { aggregateNutritionReport, buildNutritionReportDays, nutritionReportRangeDays, resolveNutritionReportRange, type NutritionReportDayLogFact, type NutritionReportMealFact } from '../nutrition/reports-core';
import { buildMobileNutritionReport, parseNutritionReportFacts } from './nutrition-report';
import { parseNutritionReport, parseReportQuery, type ReportQuery } from './nutrition-report-contract';
import { handleMobileAuthenticatedRequest } from './auth';
vi.mock('server-only',()=>({}));
vi.mock('../phase2/cordoba-date',()=>({todayInCordoba:()=> '2026-10-04'}));
import { readMobileNutritionReport } from './nutrition-report-server';
const today='2026-10-04';
const log=(date:string, overrides:Partial<NutritionReportDayLogFact>={}):NutritionReportDayLogFact=>({id:date,log_date:date,total_calories_consumed:1800,total_protein_g:80,total_carbs_g:0,total_fat_g:0,nutrition_target_kcal_snapshot:2100,protein_target_g_snapshot:100,estimated_expenditure_kcal_snapshot:2300,delta_vs_nutrition_target:-300,energy_balance_kcal:-500,water_target_l_snapshot:null,water_l:null,mate_l:null,steps:null,work_effective_snapshot:null,gym_effective_snapshot:null,gym_source_snapshot:null,nutrition_goal_period_id:null,nutrition_plan_period_id:null,goal_type_snapshot:'lose',...overrides});
const meal=(date:string, overrides:Partial<NutritionReportMealFact>={}):NutritionReportMealFact=>({day_log_id:date,entry_kind:'meal',final_calories:1800,final_protein_g:80,final_carbs_g:null,final_fat_g:0,source_type:'manual',deleted_at:null,...overrides});
const facts={dayLogs:[log('2026-10-03'),log(today,{total_calories_consumed:9000})],meals:[meal('2026-10-03'),meal('2026-10-03',{final_calories:0,final_protein_g:null}),meal(today,{final_calories:9000})],workouts:[],goalNames:new Map<string,string>()};
const build=(query:ReportQuery={period:'7'}, f=facts,t=today)=>buildMobileNutritionReport(query,resolveNutritionReportRange(query,t),t,f);
const raw=()=>({status:'ok',today,start:'2026-09-28',end:today,...facts,goalNames:[]});
describe('Mobile report domain',()=>{
 it.each(['7','14','30','3m','6m','1y'] as const)('canonical %s range and parser',period=>{const r=build({period});expect(r.range).toMatchObject(resolveNutritionReportRange({period},today).error?{}:{start:resolveNutritionReportRange({period},today).start,end:today});expect(parseNutritionReport(r)).toEqual(r);expect(r.range.days).toBeLessThanOrEqual(366);});
 it.each([['2024-02-29','1y','2023-03-01'],['2024-05-31','3m','2024-03-01'],['2025-03-31','1y','2024-04-01']] as const)('calendar clamp %s', (t,p,start)=>{expect(build({period:p},{dayLogs:[],meals:[],workouts:[],goalNames:new Map()},t).range.start).toBe(start);});
 it('custom 366 inclusive, leap and invalid/future ranges use explicit Web fallback/clamp',()=>{
   const r=build({period:'custom',from:'2023-03-01',to:'2024-02-29'},{dayLogs:[],meals:[],workouts:[],goalNames:new Map()},'2024-02-29');expect(r.range.days).toBe(366);
   const bad=build({period:'custom',from:'2023-01-01',to:today});expect(bad.range.preset).toBe('7');expect(bad.range.notice).not.toBeNull();
   expect(build({period:'custom',from:'2026-10-01',to:'2027-01-01'}).range.end).toBe(today);
   expect(build({period:'custom',from:'2027-01-01',to:'2027-02-01'}).range.notice).not.toBeNull();
 });
 it('exact Web aggregates, distinct denominators, partial known sum and today excluded',()=>{
   const range=resolveNutritionReportRange({period:'7'},today),web=aggregateNutritionReport(buildNutritionReportDays({range,today,...facts}));const r=build();
   expect(r.summary.metrics.calories).toEqual({value:web.calories.averageConsumed,denominator:1,partialDays:0});
   expect(r.summary.metrics.protein).toEqual({value:80,denominator:1,partialDays:1});expect(r.summary.metrics.carbs).toEqual({value:null,denominator:0,partialDays:0});
   expect(r.summary.metrics.targetDeviation.value).toBe(-300);expect(r.summary.accumulatedBalance.value).toBe(-500);expect(r.coverage.todayRegistered).toBe(true);
   expect(r.evolution.at(-1)?.metrics.calories.value).toBe(9000);expect(r.highlights.every(h=>h.date!==today)).toBe(true);
 });
 it('imported zero is known; missing day and persisted zero without meals remain missing',()=>{
   const r=build({period:'7'},{dayLogs:[log('2026-10-03',{total_calories_consumed:0,total_protein_g:0,delta_vs_nutrition_target:-2100,energy_balance_kcal:-2300}),log('2026-10-02',{total_calories_consumed:0})],meals:[meal('2026-10-03',{entry_kind:'legacy_daily_summary',source_type:'sheet_import',final_calories:0,final_protein_g:0})],workouts:[],goalNames:new Map()});
   expect(r.days[1]!.nutrients.calories).toMatchObject({value:0,status:'complete'});expect(r.days[1]!.imported).toBe(true);expect(r.days[2]!.nutrients.calories.value).toBeNull();expect(r.days[3]!.exists).toBe(false);expect(r.summary.metrics.calories.value).toBe(0);
 });
 it('empty differs from malformed/unavailable snapshot',()=>{expect(build({period:'7'},{dayLogs:[],meals:[],workouts:[],goalNames:new Map()}).status).toBe('empty');expect(parseNutritionReportFacts({dayLogs:[]})).toBeUndefined();expect(parseNutritionReportFacts(raw())).toBeDefined();});
 it('large periods bucket on server and no comparisons/product identity leak',()=>{const r=build({period:'1y'});expect(r.evolution.length).toBeLessThanOrEqual(12);expect(JSON.stringify(r)).not.toContain('day_log_id');expect(JSON.stringify(r)).not.toContain('previous');});
 it('parser rejects unknown, false zeros, wrong dates, denominators and malformed series',()=>{
   const r=build();expect(parseNutritionReport({...r,summary:{...r.summary,metrics:{...r.summary.metrics,carbs:{value:0,denominator:0,partialDays:0}}}})).toBeUndefined();
   expect(parseNutritionReport({...r,days:r.days.slice(1)})).toBeUndefined();expect(parseNutritionReport({...r,evolution:[]})).toBeUndefined();expect(parseReportQuery({period:'3w'})).toBeUndefined();expect(parseReportQuery({period:'7',user_id:'other'})).toBeUndefined();
 });
});
describe('Mobile report server boundary',()=>{
 const context=(rpc:unknown)=>({supabase:{rpc}}) as Parameters<typeof readMobileNutritionReport>[1];
 it('one authenticated period request and canonical facts',async()=>{const rpc=vi.fn().mockResolvedValue({data:raw(),error:null});const r=await readMobileNutritionReport(new URLSearchParams('period=7'),context(rpc));expect(r.summary.metrics.calories.value).toBe(1800);expect(rpc).toHaveBeenCalledTimes(1);expect(rpc).toHaveBeenCalledWith('mobile_read_nutrition_report',{p_start:'2026-09-28',p_end:today,p_expected_today:today},{get:true});});
 it('auth before reads, validation and unavailable never empty',async()=>{
   const read=vi.fn();expect((await handleMobileAuthenticatedRequest(null,{authenticate:vi.fn(),read})).status).toBe(401);expect(read).not.toHaveBeenCalled();
   const rpc=vi.fn().mockResolvedValue({data:{status:'unavailable',today},error:null});await expect(readMobileNutritionReport(new URLSearchParams('period=7'),context(rpc))).rejects.toThrow('unavailable');
   await expect(readMobileNutritionReport(new URLSearchParams('period=7&period=14'),context(rpc))).rejects.toThrow('repetido');await expect(readMobileNutritionReport(new URLSearchParams('user_id=other'),context(rpc))).rejects.toThrow('no válido');
 });
 it('midnight re-resolves once; repeated change/unavailable is explicit',async()=>{
   const rpc=vi.fn().mockResolvedValueOnce({data:{status:'day_changed',today:'2026-10-05'},error:null}).mockResolvedValueOnce({data:{...raw(),today:'2026-10-05',start:'2026-09-29',end:'2026-10-05'},error:null});
   expect((await readMobileNutritionReport(new URLSearchParams(),context(rpc))).today).toBe('2026-10-05');expect(rpc).toHaveBeenCalledTimes(2);
   const bad=vi.fn().mockResolvedValue({data:{status:'day_changed',today},error:null});await expect(readMobileNutritionReport(new URLSearchParams(),context(bad))).rejects.toThrow('date changed');expect(bad).toHaveBeenCalledTimes(2);
 });
 it('resolver never exceeds 366 and does not request future',()=>{for(const period of ['7','14','30','3m','6m','1y']){const r=resolveNutritionReportRange({period},today);expect(nutritionReportRangeDays(r)).toBeLessThanOrEqual(366);expect(r.end<=today).toBe(true);}});
});
