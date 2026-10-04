import { aggregateNutritionReport, buildNutritionReportDays, isNutritionReportMeal, nutritionReportRangeDays, type NutritionReportDay, type NutritionReportDayLogFact, type NutritionReportMealFact, type NutritionReportRange, type NutritionReportWorkoutFact } from '../nutrition/reports-core';
import { bucketNutritionChartDays, averageBucketValue } from '../nutrition/report-chart-core';
import { buildNutritionReportDayHighlights } from '../nutrition/report-v2';
import { REPORT_METRICS, REPORT_NUTRIENTS, parseNutritionReport, type NutritionReport, type ReportDailyRow, type ReportMetric, type ReportQuery, type ReportStatistic } from './nutrition-report-contract';

type Facts = { dayLogs: NutritionReportDayLogFact[]; meals: NutritionReportMealFact[]; workouts: NutritionReportWorkoutFact[]; goalNames: Map<string,string> };
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const nullable = (v: unknown) => v === null || finite(v);
const record = (v:unknown):v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Validate the database boundary too: a truncated/malformed snapshot is unavailable, never empty. */
export function parseNutritionReportFacts(raw: unknown): Facts | undefined {
  if (!record(raw) || !Array.isArray(raw.dayLogs) || !Array.isArray(raw.meals) || !Array.isArray(raw.workouts) || !Array.isArray(raw.goalNames)) return;
  if (!raw.dayLogs.every(d => record(d) && typeof d.id === 'string' && typeof d.log_date === 'string'
    && ['total_calories_consumed','total_protein_g','total_carbs_g','total_fat_g'].every(k => finite(d[k]))
    && ['nutrition_target_kcal_snapshot','protein_target_g_snapshot','water_target_l_snapshot','estimated_expenditure_kcal_snapshot','delta_vs_nutrition_target','energy_balance_kcal','water_l','mate_l','steps'].every(k => nullable(d[k])))) return;
  if (!raw.meals.every(m => record(m) && typeof m.day_log_id === 'string' && ['meal','legacy_daily_summary'].includes(String(m.entry_kind))
    && ['final_calories','final_protein_g','final_carbs_g','final_fat_g'].every(k => nullable(m[k]))
    && (m.source_type === null || typeof m.source_type === 'string') && (m.deleted_at === null || typeof m.deleted_at === 'string'))) return;
  if (!raw.workouts.every(w => record(w) && typeof w.day_log_id === 'string' && ['in_progress','completed','discarded'].includes(String(w.status)))
    || !raw.goalNames.every(n => record(n) && typeof n.id === 'string' && typeof n.name === 'string')) return;
  return {dayLogs: raw.dayLogs as NutritionReportDayLogFact[], meals: raw.meals as NutritionReportMealFact[], workouts: raw.workouts as NutritionReportWorkoutFact[],
    goalNames: new Map(raw.goalNames.map(n => [n.id as string,n.name as string]))};
}
const values = (d: NutritionReportDay): Record<ReportMetric,number|null> => ({calories:d.calories,targetCalories:d.targetCalories,targetDeviation:d.targetDeviationKcal,
  expenditure:d.expenditureKcal,balance:d.energyBalanceKcal,protein:d.proteinG,targetProtein:d.targetProteinG,carbs:d.carbsG,fat:d.fatG});

export function buildMobileNutritionReport(query: ReportQuery, range: NutritionReportRange, today: string, facts: Facts): NutritionReport {
  const coreDays = buildNutritionReportDays({range,today,...facts});
  const summary = aggregateNutritionReport(coreDays);
  const mealsByDay = new Map<string,NutritionReportMealFact[]>();
  for (const meal of facts.meals.filter(isNutritionReportMeal)) {
    const meals = mealsByDay.get(meal.day_log_id) ?? []; meals.push(meal); mealsByDay.set(meal.day_log_id,meals);
  }
  const field = {calories:'final_calories',protein:'final_protein_g',carbs:'final_carbs_g',fat:'final_fat_g'} as const;
  const days: ReportDailyRow[] = coreDays.map(d => {
    const meals = mealsByDay.get(d.dayLogId ?? '') ?? [];
    const nutrients = Object.fromEntries(REPORT_NUTRIENTS.map(k => {
      const knownMeals = meals.filter(m => m[field[k]] !== null).length;
      const missingMeals = meals.length-knownMeals;
      return [k,{value:values(d)[k],knownMeals,missingMeals,status:meals.length===0?'none':knownMeals===0?'unknown':missingMeals>0?'partial':'complete'}];
    })) as ReportDailyRow['nutrients'];
    return {date:d.date,exists:d.dayLogId!==null,hasNutrition:d.hasNutrition,imported:d.imported,isToday:d.isToday,mealCount:d.activeMealCount,nutrients,
      targetCalories:d.targetCalories,targetProteinG:d.targetProteinG,expenditureKcal:d.expenditureKcal,targetDeviationKcal:d.targetDeviationKcal,energyBalanceKcal:d.energyBalanceKcal,goalStage:d.goalStage};
  });
  const rows = new Map(days.map(d => [d.date,d]));
  const partial = (d:NutritionReportDay,k:ReportMetric) => {
    const nutrient = k==='targetCalories'||k==='targetDeviation'||k==='expenditure'||k==='balance'?'calories':k==='targetProtein'?'protein':k;
    return rows.get(d.date)!.nutrients[nutrient].status==='partial';
  };
  const completed = coreDays.filter(d=>d.hasNutrition&&d.isComplete);
  const calorieDays = completed.filter(d=>d.calories!==null);
  const targetDays = calorieDays.filter(d=>d.targetCalories!==null&&d.targetDeviationKcal!==null);
  const balanceDays = calorieDays.filter(d=>d.energyBalanceKcal!==null);
  const proteinDays = completed.filter(d=>d.proteinG!==null);
  const proteinComparable = proteinDays.filter(d=>d.targetProteinG!==null);
  const samples:Record<ReportMetric,NutritionReportDay[]> = {calories:calorieDays,targetCalories:targetDays,targetDeviation:targetDays,expenditure:balanceDays,balance:balanceDays,
    protein:proteinDays,targetProtein:proteinComparable,carbs:completed.filter(d=>d.carbsG!==null),fat:completed.filter(d=>d.fatG!==null)};
  const means:Record<ReportMetric,number|null> = {calories:summary.calories.averageConsumed,targetCalories:summary.calories.averageTarget,targetDeviation:summary.calories.averageTargetDeviation,
    expenditure:summary.energy.averageExpenditure,balance:summary.energy.averageBalance,protein:summary.protein.averageConsumed,targetProtein:summary.protein.averageTarget,
    carbs:summary.carbs.averageConsumed,fat:summary.fat.averageConsumed};
  const stat = (k:ReportMetric, data:NutritionReportDay[], value:number|null):ReportStatistic => ({value,denominator:data.length,partialDays:data.filter(d=>partial(d,k)).length});
  const metrics = Object.fromEntries(REPORT_METRICS.map(k=>[k,stat(k,samples[k],means[k])])) as Record<ReportMetric,ReportStatistic>;
  const finalized = days.filter(d=>!d.isToday);
  const coverage: NutritionReport['coverage'] = {registeredDays:summary.registeredDays,completedRegisteredDays:summary.completedRegisteredDays,
    finalizedDays:finalized.length,missingDays:finalized.filter(d=>!d.hasNutrition).length,todayRegistered:summary.currentDayRegistered,
    nutrients:Object.fromEntries(REPORT_NUTRIENTS.map(k=>[k,{knownDays:finalized.filter(d=>d.nutrients[k].value!==null).length,
      partialDays:finalized.filter(d=>d.nutrients[k].status==='partial').length,unknownDays:finalized.filter(d=>d.hasNutrition&&d.nutrients[k].value===null).length}])) as NutritionReport['coverage']['nutrients']};
  const evolution = bucketNutritionChartDays([...coreDays].reverse()).map(bucket=>({start:bucket.start,end:bucket.end,includesToday:bucket.includesToday,
    metrics:Object.fromEntries(REPORT_METRICS.map(k=>{
      const known=bucket.values.filter(d=>d.hasNutrition&&values(d)[k]!==null);
      return [k,stat(k,known,averageBucketValue(bucket,d=>d.hasNutrition?values(d)[k]:null))];
    })) as Record<ReportMetric,ReportStatistic>}));
  const result: NutritionReport = {today,range:{requested:query,preset:range.preset,start:range.start,end:range.end,days:nutritionReportRangeDays(range),notice:range.error ?? (query.period==='custom'&&query.to!>today?'Se excluyeron las fechas futuras.':null)},
    status:summary.registeredDays===0?'empty':coverage.missingDays>0||finalized.some(d=>d.hasNutrition&&(REPORT_NUTRIENTS.some(k=>d.nutrients[k].status!=='complete')||d.targetCalories===null||d.targetProteinG===null||d.expenditureKcal===null))?'partial':'complete',
    summary:{metrics,accumulatedBalance:stat('balance',balanceDays,summary.energy.accumulatedBalance),belowTargetDays:summary.calories.belowTargetDays,exactTargetDays:summary.calories.exactTargetDays,aboveTargetDays:summary.calories.aboveTargetDays,
      deficitDays:summary.energy.deficitDays,neutralDays:summary.energy.neutralDays,surplusDays:summary.energy.surplusDays,proteinHitDays:summary.protein.hitDays,proteinComparableDays:summary.protein.comparableDays,goalStages:summary.goalStages},
    coverage,evolution,highlights:buildNutritionReportDayHighlights(coreDays).map(h=>({date:h.day.date,kind:h.kind,title:h.title})),days};
  if (!parseNutritionReport(result)) throw new Error('Invalid report model');
  return result;
}
