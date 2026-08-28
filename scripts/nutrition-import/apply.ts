import type { DryRunPlan, ProductionSnapshot } from "./types.ts";

export type ApplyMode = "rollback" | "commit";

export type ApplyBuildOptions = {
  plan: DryRunPlan;
  production: ProductionSnapshot;
  expectedSha: string;
  target: "production";
  mode: ApplyMode;
};

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonLiteral(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function periodDate(ref: string): string {
  const value = ref.slice(ref.lastIndexOf(":") + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Referencia de período inválida: ${ref}`);
  return value;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function expectedDays(plan: DryRunPlan, production: ProductionSnapshot) {
  const mealsByDate = Map.groupBy(plan.meals.rows.filter((meal) => meal.active), (meal) => meal.logDate);
  return plan.dayLogs.map((day) => {
    const fields = day.expectedFields;
    const existing = production.day_logs.find((row) => row.log_date === day.logDate);
    const meals = mealsByDate.get(day.logDate) ?? [];
    const calories = meals.reduce((sum, meal) => sum + meal.finalCalories, 0);
    const protein = rounded(meals.reduce((sum, meal) => sum + (meal.finalProteinG ?? 0), 0));
    const carbs = rounded(meals.reduce((sum, meal) => sum + (meal.finalCarbsG ?? 0), 0));
    const fat = rounded(meals.reduce((sum, meal) => sum + (meal.finalFatG ?? 0), 0));
    const target = fields.nutrition_target_kcal_snapshot as number;
    const expenditure = fields.estimated_expenditure_kcal_snapshot as number;
    return {
      log_date: day.logDate,
      classification: day.classification,
      weight_kg: fields.weight_kg ?? existing?.weight_kg ?? null,
      notes: fields.notes ?? null,
      work_override: fields.work_override ?? null,
      work_override_source: fields.work_override_source ?? null,
      work_override_reason: fields.work_override_reason ?? null,
      gym_override: fields.gym_override ?? null,
      gym_override_source: fields.gym_override_source ?? null,
      gym_override_reason: fields.gym_override_reason ?? null,
      steps: fields.steps ?? null,
      water_l: fields.water_l ?? null,
      mate_l: fields.mate_l ?? null,
      expenditure_override_kcal: fields.expenditure_override_kcal ?? null,
      work_effective_snapshot: fields.work_effective_snapshot,
      gym_effective_snapshot: fields.gym_effective_snapshot,
      work_source_snapshot: fields.work_source_snapshot,
      gym_source_snapshot: fields.gym_source_snapshot,
      goal_effective_from: periodDate(day.nutritionGoalRef),
      expenditure_effective_from: periodDate(day.expenditureRuleRef),
      schedule_effective_from: periodDate(day.workScheduleRef),
      nutrition_target_kcal_snapshot: target,
      protein_target_g_snapshot: fields.protein_target_g_snapshot,
      water_target_l_snapshot: fields.water_target_l_snapshot,
      estimated_expenditure_kcal_snapshot: expenditure,
      total_calories_consumed: calories,
      total_protein_g: protein,
      total_carbs_g: carbs,
      total_fat_g: fat,
      delta_vs_nutrition_target: calories - target,
      energy_balance_kcal: calories - expenditure,
    };
  });
}

function assertApplyGuards(options: ApplyBuildOptions): void {
  if (options.target !== "production") throw new Error("El target debe ser production");
  if (options.plan.sourceSha256 !== options.expectedSha) throw new Error("El SHA del plan no coincide con --expected-sha");
  if (!options.plan.applyReady || options.plan.blockers.length > 0) throw new Error("El plan no está APPLY_READY");
  if (!options.production.user_id) throw new Error("El snapshot productivo no contiene user_id");
  const alreadyApplied = options.production.applied_imports?.some(
    (run) => run.source_name === options.plan.sourceName && run.source_sha256 === options.expectedSha,
  );
  if (alreadyApplied) throw new Error("ALREADY_IMPORTED");
  if (options.plan.dayLogs.some((day) => day.classification === "CONFLICT")) throw new Error("El plan contiene day_logs en conflicto");
  if (options.plan.reconciliation.mismatchDays !== 0) throw new Error("El plan contiene mismatches de reconciliación");
  if (options.plan.dayLogs.length !== 46) throw new Error("Se esperaban 46 días históricos");
  if (options.plan.meals.rows.filter((meal) => meal.active).length !== 227) throw new Error("Se esperaban 227 comidas activas");
  if (options.plan.meals.detailed !== 220 || options.plan.meals.legacySummaries !== 7) throw new Error("La composición de comidas no coincide con el plan aprobado");
  if (options.plan.goalPeriods.length !== 2 || options.plan.expenditurePeriods.length !== 1 || options.plan.workSchedulePeriods.length !== 1) throw new Error("Los períodos no coinciden con el plan aprobado");
  if (options.plan.foods.length !== 10) throw new Error("Se esperaban 10 alimentos");
  if (options.plan.bodyMeasurements.rows.filter((row) => row.disposition === "IMPORT").length !== 1) throw new Error("Se esperaba una medición importable");
  if (options.plan.nutritionEvents.rows.length !== 8) throw new Error("Se esperaban 8 eventos nutricionales");
}

export function isAlreadyImported(plan: DryRunPlan, production: ProductionSnapshot): boolean {
  return production.applied_imports?.some(
    (run) => run.source_name === plan.sourceName && run.source_sha256 === plan.sourceSha256,
  ) ?? false;
}

function buildHistoricalImportSqlWithoutSession(options: ApplyBuildOptions): string {
  assertApplyGuards(options);
  const { plan, production } = options;
  const userId = production.user_id!;
  const hashes = production.regression_hashes;
  if (!hashes?.profiles || !hashes.workout_sessions || !hashes.workout_session_exercises || !hashes.workout_sets) {
    throw new Error("Faltan hashes productivos requeridos");
  }

  const days = expectedDays(plan, production);
  const counts = {
    dayLogs: plan.dayLogs.length,
    insertedDayLogs: plan.dayLogs.filter((day) => day.classification === "INSERT").length,
    mergedDayLogs: plan.dayLogs.filter((day) => day.classification === "MERGE_SAFE").length,
    meals: plan.meals.rows.length,
    detailedMeals: plan.meals.detailed,
    legacySummaries: plan.meals.legacySummaries,
    goalPeriods: plan.goalPeriods.length,
    expenditurePeriods: plan.expenditurePeriods.length,
    workSchedulePeriods: plan.workSchedulePeriods.length,
    foods: plan.foods.length,
    bodyMeasurements: plan.bodyMeasurements.rows.filter((row) => row.disposition === "IMPORT").length,
    nutritionEvents: plan.nutritionEvents.rows.length,
  };
  const report = {
    source: { name: plan.sourceName, sha256: plan.sourceSha256, range: plan.sourceRange },
    counts,
    reconciliation: plan.reconciliation,
    anomalies: plan.importReport.anomalies,
    skippedUndatedFacts: plan.importReport.skippedUndatedFacts,
    suspectMeasurements: plan.importReport.suspectMeasurements,
    sourceWinsWarnings: plan.importReport.sourceWinsWarnings,
    decisions: plan.importReport.decisions,
    dayLogClassifications: Object.fromEntries(
      [...Map.groupBy(plan.dayLogs, (day) => day.classification)].map(([key, value]) => [key, value.length]),
    ),
    applyReady: true,
    blockers: [],
  };

  const goalRows = plan.goalPeriods.map((row) => ({
    effective_from: row.effectiveFrom, name: row.name,
    calories_no_gym: row.caloriesNoGym, calories_gym: row.caloriesGym,
    protein_no_gym_g: row.proteinNoGymG, protein_gym_g: row.proteinGymG,
    water_no_gym_l: row.waterNoGymL, water_gym_l: row.waterGymL,
  }));
  const expenditureRows = plan.expenditurePeriods.map((row) => ({
    effective_from: row.effectiveFrom, name: row.name,
    work_gym_kcal: row.workGymKcal, work_no_gym_kcal: row.workNoGymKcal,
    no_work_gym_kcal: row.noWorkGymKcal, no_work_no_gym_kcal: row.noWorkNoGymKcal,
  }));
  const scheduleRows = plan.workSchedulePeriods.map((row) => ({
    effective_from: row.effectiveFrom, name: row.name,
    monday: row.monday, tuesday: row.tuesday, wednesday: row.wednesday,
    thursday: row.thursday, friday: row.friday, saturday: row.saturday, sunday: row.sunday,
  }));
  const mealRows = plan.meals.rows.map((row) => ({
    log_date: row.logDate, consumed_at: row.consumedAt, meal_label: row.mealLabel,
    title: row.title, description: null, final_calories: row.finalCalories,
    final_protein_g: row.finalProteinG, final_carbs_g: row.finalCarbsG, final_fat_g: row.finalFatG,
    source_type: row.sourceType, entry_kind: row.entryKind, precision_level: row.precisionLevel,
    context_type: row.contextType, source_note: row.sourceNote, raw_input: JSON.stringify(row.rawInput),
    legacy_import_source: row.legacyImportSource, legacy_import_id: row.legacyImportId,
    active: row.active,
  }));
  const foodRows = plan.foods.map((row) => ({
    name: row.name, serving_quantity: row.servingQuantity, serving_unit: row.servingUnit,
    calories: row.calories, protein_g: row.proteinG, carbs_g: row.carbsG, fat_g: row.fatG,
    precision_level: row.precisionLevel, source_note: row.sourceNote, is_active: row.active,
  }));
  const bodyRows = plan.bodyMeasurements.rows.filter((row) => row.disposition === "IMPORT").map((row) => ({
    measured_on: row.measuredOn, waist_cm: row.waistCm, abdomen_cm: row.abdomenCm,
    chest_cm: row.chestCm, hip_cm: row.hipCm, arm_right_cm: row.armRightCm,
    arm_left_cm: row.armLeftCm, thigh_right_cm: row.thighRightCm, thigh_left_cm: row.thighLeftCm,
    calf_right_cm: row.calfRightCm, calf_left_cm: row.calfLeftCm, condition: row.condition,
    notes: row.notes, legacy_import_source: row.legacyImportSource, legacy_import_id: row.legacyImportId,
    quality_status: row.qualityStatus, quality_note: row.qualityNote, source_payload: row.sourcePayload,
  }));
  const eventRows = plan.nutritionEvents.rows.map((row) => ({
    event_date: row.eventDate, event_type: row.eventType, intensity: row.intensity,
    planned: row.planned, alcohol: row.alcohol, drinks_equivalent: row.drinksEquivalent,
    event_calories: row.eventCalories, context: row.context, notes: row.notes, origin: row.origin,
    source_type: row.sourceType, legacy_import_source: row.legacyImportSource,
    legacy_import_id: row.legacyImportId,
  }));

  const end = options.mode === "commit" ? "commit;" : "rollback;";
  return `-- OWNLEVEL issue #29: payload privado generado desde el plan aprobado.\nbegin;\nset local statement_timeout = '300s';\n\ncreate temp table _nutrition_import_ctx (user_id uuid primary key, import_run_id uuid not null) on commit drop;\ninsert into _nutrition_import_ctx values (${sqlLiteral(userId)}::uuid, gen_random_uuid());\n\ndo $guard$\nbegin\n  if exists (select 1 from public.nutrition_import_runs where user_id=${sqlLiteral(userId)}::uuid and source_name=${sqlLiteral(plan.sourceName)} and source_sha256=${sqlLiteral(plan.sourceSha256)}) then\n    raise exception 'ALREADY_IMPORTED';\n  end if;\n  if (select count(*) from public.profiles) <> ${production.regression_counts.profiles}\n    or (select count(*) from public.day_logs) <> ${production.regression_counts.day_logs}\n    or (select count(*) from public.meal_entries) <> ${production.meal_entries_count}\n    or (select count(*) from public.workout_sessions) <> ${production.regression_counts.workout_sessions}\n    or (select count(*) from public.workout_session_exercises) <> ${production.regression_counts.workout_session_exercises}\n    or (select count(*) from public.workout_sets) <> ${production.regression_counts.workout_sets}\n    or (select count(*) from public.body_measurements) <> ${production.regression_counts.body_measurements}\n    or (select count(*) from public.nutrition_events) <> ${(production.config_counts.nutrition_events ?? 0)}\n    or (select count(*) from public.nutrition_goal_periods) <> ${production.config_counts.nutrition_goal_periods}\n    or (select count(*) from public.expenditure_rule_periods) <> ${production.config_counts.expenditure_rule_periods}\n    or (select count(*) from public.work_schedule_periods) <> ${production.config_counts.work_schedule_periods}\n    or (select count(*) from public.nutrition_import_runs) <> ${production.config_counts.nutrition_import_runs}\n    or (select count(*) from public.foods) <> ${production.config_counts.foods} then\n    raise exception 'BASELINE_CHANGED';\n  end if;\n  if (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.user_id::text),'')) from (select * from public.profiles) x) <> ${sqlLiteral(hashes.profiles)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_sessions) x) <> ${sqlLiteral(hashes.workout_sessions)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_session_exercises) x) <> ${sqlLiteral(hashes.workout_session_exercises)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_sets) x) <> ${sqlLiteral(hashes.workout_sets)} then\n    raise exception 'BASELINE_HASH_CHANGED';\n  end if;\nend;\n$guard$;\n\ncreate temp table _existing_day_invariants on commit drop as\nselect id, log_date, created_at, bmr_kcal_snapshot, maintenance_kcal_snapshot, target_kcal_snapshot, goal_type_snapshot\nfrom public.day_logs where user_id=${sqlLiteral(userId)}::uuid;\n\ncreate temp table _expected_days on commit drop as\nselect * from jsonb_to_recordset(${jsonLiteral(days)}) as x(\n  log_date date, classification text, weight_kg numeric, notes text,\n  work_override boolean, work_override_source text, work_override_reason text,\n  gym_override boolean, gym_override_source text, gym_override_reason text,\n  steps integer, water_l numeric, mate_l numeric, expenditure_override_kcal integer,\n  work_effective_snapshot boolean, gym_effective_snapshot boolean, work_source_snapshot text, gym_source_snapshot text,\n  goal_effective_from date, expenditure_effective_from date, schedule_effective_from date,\n  nutrition_target_kcal_snapshot integer, protein_target_g_snapshot numeric, water_target_l_snapshot numeric,\n  estimated_expenditure_kcal_snapshot integer, total_calories_consumed integer, total_protein_g numeric,\n  total_carbs_g numeric, total_fat_g numeric, delta_vs_nutrition_target integer, energy_balance_kcal integer\n);\n\ninsert into public.nutrition_import_runs (id,user_id,source_name,source_sha256,applied_at,counts,report)\nselect import_run_id,user_id,${sqlLiteral(plan.sourceName)},${sqlLiteral(plan.sourceSha256)},now(),${jsonLiteral(counts)},${jsonLiteral(report)} from _nutrition_import_ctx;\n\ninsert into public.nutrition_goal_periods (user_id,effective_from,name,calories_no_gym,calories_gym,protein_no_gym_g,protein_gym_g,water_no_gym_l,water_gym_l)\nselect c.user_id,x.* from _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(goalRows)}) as x(effective_from date,name text,calories_no_gym integer,calories_gym integer,protein_no_gym_g numeric,protein_gym_g numeric,water_no_gym_l numeric,water_gym_l numeric);\n\ninsert into public.expenditure_rule_periods (user_id,effective_from,name,work_gym_kcal,work_no_gym_kcal,no_work_gym_kcal,no_work_no_gym_kcal)\nselect c.user_id,x.* from _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(expenditureRows)}) as x(effective_from date,name text,work_gym_kcal integer,work_no_gym_kcal integer,no_work_gym_kcal integer,no_work_no_gym_kcal integer);\n\ninsert into public.work_schedule_periods (user_id,effective_from,name,monday,tuesday,wednesday,thursday,friday,saturday,sunday)\nselect c.user_id,x.* from _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(scheduleRows)}) as x(effective_from date,name text,monday boolean,tuesday boolean,wednesday boolean,thursday boolean,friday boolean,saturday boolean,sunday boolean);\n\ninsert into public.day_logs (user_id,log_date,weight_kg,notes,work_override,work_override_source,work_override_reason,gym_override,gym_override_source,gym_override_reason,steps,water_l,mate_l,expenditure_override_kcal,work_effective_snapshot,gym_effective_snapshot,work_source_snapshot,gym_source_snapshot,nutrition_goal_period_id,expenditure_rule_period_id,work_schedule_period_id,nutrition_target_kcal_snapshot,protein_target_g_snapshot,water_target_l_snapshot,estimated_expenditure_kcal_snapshot)\nselect c.user_id,e.log_date,e.weight_kg,e.notes,e.work_override,e.work_override_source,e.work_override_reason,e.gym_override,e.gym_override_source,e.gym_override_reason,e.steps,e.water_l,e.mate_l,e.expenditure_override_kcal,e.work_effective_snapshot,e.gym_effective_snapshot,e.work_source_snapshot,e.gym_source_snapshot,g.id,r.id,s.id,e.nutrition_target_kcal_snapshot,e.protein_target_g_snapshot,e.water_target_l_snapshot,e.estimated_expenditure_kcal_snapshot\nfrom _expected_days e cross join _nutrition_import_ctx c\njoin public.nutrition_goal_periods g on g.user_id=c.user_id and g.effective_from=e.goal_effective_from\njoin public.expenditure_rule_periods r on r.user_id=c.user_id and r.effective_from=e.expenditure_effective_from\njoin public.work_schedule_periods s on s.user_id=c.user_id and s.effective_from=e.schedule_effective_from\nwhere e.classification='INSERT';\n\nupdate public.day_logs d set\n  weight_kg=coalesce(e.weight_kg,d.weight_kg), notes=coalesce(e.notes,d.notes),\n  work_override=e.work_override, work_override_source=e.work_override_source, work_override_reason=e.work_override_reason,\n  gym_override=e.gym_override, gym_override_source=e.gym_override_source, gym_override_reason=e.gym_override_reason,\n  steps=e.steps, water_l=e.water_l, mate_l=e.mate_l, expenditure_override_kcal=e.expenditure_override_kcal\nfrom _expected_days e, _nutrition_import_ctx c\nwhere d.user_id=c.user_id and d.log_date=e.log_date and e.classification='MERGE_SAFE';\n\nupdate public.day_logs d set\n  work_effective_snapshot=e.work_effective_snapshot, gym_effective_snapshot=e.gym_effective_snapshot,\n  work_source_snapshot=e.work_source_snapshot, gym_source_snapshot=e.gym_source_snapshot,\n  nutrition_goal_period_id=g.id, expenditure_rule_period_id=r.id, work_schedule_period_id=s.id,\n  nutrition_target_kcal_snapshot=e.nutrition_target_kcal_snapshot, protein_target_g_snapshot=e.protein_target_g_snapshot,\n  water_target_l_snapshot=e.water_target_l_snapshot, estimated_expenditure_kcal_snapshot=e.estimated_expenditure_kcal_snapshot\nfrom _expected_days e cross join _nutrition_import_ctx c\njoin public.nutrition_goal_periods g on g.user_id=c.user_id and g.effective_from=e.goal_effective_from\njoin public.expenditure_rule_periods r on r.user_id=c.user_id and r.effective_from=e.expenditure_effective_from\njoin public.work_schedule_periods s on s.user_id=c.user_id and s.effective_from=e.schedule_effective_from\nwhere d.user_id=c.user_id and d.log_date=e.log_date;\n\ninsert into public.meal_entries (user_id,day_log_id,consumed_at,meal_label,title,description,final_calories,final_protein_g,final_carbs_g,final_fat_g,source_type,deleted_at,entry_kind,precision_level,context_type,source_note,raw_input,legacy_import_source,legacy_import_id,import_run_id)\nselect c.user_id,d.id,x.consumed_at,x.meal_label,x.title,x.description,x.final_calories,x.final_protein_g,x.final_carbs_g,x.final_fat_g,x.source_type,case when x.active then null else now() end,x.entry_kind,x.precision_level,x.context_type,x.source_note,x.raw_input,x.legacy_import_source,x.legacy_import_id,c.import_run_id\nfrom jsonb_to_recordset(${jsonLiteral(mealRows)}) as x(log_date date,consumed_at timestamptz,meal_label text,title text,description text,final_calories integer,final_protein_g numeric,final_carbs_g numeric,final_fat_g numeric,source_type text,entry_kind text,precision_level text,context_type text,source_note text,raw_input text,legacy_import_source text,legacy_import_id text,active boolean)\ncross join _nutrition_import_ctx c join public.day_logs d on d.user_id=c.user_id and d.log_date=x.log_date;\n\ninsert into public.foods (user_id,name,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,precision_level,source_note,is_active)\nselect c.user_id,x.* from _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(foodRows)}) as x(name text,serving_quantity numeric,serving_unit text,calories integer,protein_g numeric,carbs_g numeric,fat_g numeric,precision_level text,source_note text,is_active boolean);\n\ninsert into public.body_measurements (user_id,measured_on,waist_cm,abdomen_cm,chest_cm,hip_cm,arm_right_cm,arm_left_cm,thigh_right_cm,thigh_left_cm,calf_right_cm,calf_left_cm,condition,notes,legacy_import_source,legacy_import_id,import_run_id,quality_status,quality_note,source_payload)\nselect c.user_id,x.measured_on,x.waist_cm,x.abdomen_cm,x.chest_cm,x.hip_cm,x.arm_right_cm,x.arm_left_cm,x.thigh_right_cm,x.thigh_left_cm,x.calf_right_cm,x.calf_left_cm,x.condition,x.notes,x.legacy_import_source,x.legacy_import_id,c.import_run_id,x.quality_status,x.quality_note,x.source_payload\nfrom _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(bodyRows)}) as x(measured_on date,waist_cm numeric,abdomen_cm numeric,chest_cm numeric,hip_cm numeric,arm_right_cm numeric,arm_left_cm numeric,thigh_right_cm numeric,thigh_left_cm numeric,calf_right_cm numeric,calf_left_cm numeric,condition text,notes text,legacy_import_source text,legacy_import_id text,quality_status text,quality_note text,source_payload jsonb);\n\ninsert into public.nutrition_events (user_id,event_date,event_type,intensity,planned,alcohol,drinks_equivalent,event_calories,context,notes,origin,source_type,legacy_import_source,legacy_import_id,import_run_id)\nselect c.user_id,x.event_date,x.event_type,x.intensity,x.planned,x.alcohol,x.drinks_equivalent,x.event_calories,x.context,x.notes,x.origin,x.source_type,x.legacy_import_source,x.legacy_import_id,c.import_run_id\nfrom _nutrition_import_ctx c cross join jsonb_to_recordset(${jsonLiteral(eventRows)}) as x(event_date date,event_type text,intensity text,planned boolean,alcohol boolean,drinks_equivalent numeric,event_calories integer,context text,notes text,origin text,source_type text,legacy_import_source text,legacy_import_id text);\n\ndo $assert$\ndeclare v_user uuid := ${sqlLiteral(userId)}::uuid;\nbegin\n  if (select count(*) from _expected_days) <> 46\n    or (select count(*) from public.day_logs d join _expected_days e using(log_date) where d.user_id=v_user) <> 46\n    or (select count(*) from public.day_logs) <> ${production.regression_counts.day_logs + counts.insertedDayLogs}\n    or (select count(*) from public.meal_entries where user_id=v_user and deleted_at is null and import_run_id=(select import_run_id from _nutrition_import_ctx)) <> 227\n    or (select count(*) from public.nutrition_goal_periods where user_id=v_user) <> 2\n    or (select count(*) from public.expenditure_rule_periods where user_id=v_user) <> 1\n    or (select count(*) from public.work_schedule_periods where user_id=v_user) <> 1\n    or (select count(*) from public.foods where user_id=v_user) <> 10\n    or (select count(*) from public.body_measurements where user_id=v_user and import_run_id=(select import_run_id from _nutrition_import_ctx)) <> 1\n    or (select count(*) from public.nutrition_events where user_id=v_user and import_run_id=(select import_run_id from _nutrition_import_ctx)) <> 8\n    or (select count(*) from public.nutrition_import_runs where user_id=v_user and source_sha256=${sqlLiteral(plan.sourceSha256)}) <> 1 then\n    raise exception 'IMPORT_COUNT_ASSERT_FAILED';\n  end if;\n  if exists (select 1 from public.meal_entries where user_id=v_user and import_run_id<>(select import_run_id from _nutrition_import_ctx) and legacy_import_source is not null)\n    or exists (select 1 from public.meal_entries where user_id=v_user group by legacy_import_source,legacy_import_id having legacy_import_source is not null and count(*)>1)\n    or exists (select 1 from public.body_measurements where user_id=v_user group by legacy_import_source,legacy_import_id having legacy_import_source is not null and count(*)>1)\n    or exists (select 1 from public.nutrition_events where user_id=v_user group by legacy_import_source,legacy_import_id having legacy_import_source is not null and count(*)>1) then\n    raise exception 'IMPORT_IDEMPOTENCY_ASSERT_FAILED';\n  end if;\n  if exists (select 1 from _existing_day_invariants b left join public.day_logs d on d.id=b.id where d.id is null or d.log_date is distinct from b.log_date or d.created_at is distinct from b.created_at or d.bmr_kcal_snapshot is distinct from b.bmr_kcal_snapshot or d.maintenance_kcal_snapshot is distinct from b.maintenance_kcal_snapshot or d.target_kcal_snapshot is distinct from b.target_kcal_snapshot or d.goal_type_snapshot is distinct from b.goal_type_snapshot) then\n    raise exception 'EXISTING_DAY_INVARIANT_CHANGED';\n  end if;\n  if exists (select 1 from _expected_days e join public.day_logs d on d.user_id=v_user and d.log_date=e.log_date join public.nutrition_goal_periods g on g.id=d.nutrition_goal_period_id join public.expenditure_rule_periods r on r.id=d.expenditure_rule_period_id join public.work_schedule_periods s on s.id=d.work_schedule_period_id where\n    d.weight_kg is distinct from e.weight_kg or d.work_override is distinct from e.work_override or d.gym_override is distinct from e.gym_override or d.steps is distinct from e.steps or d.water_l is distinct from e.water_l or d.mate_l is distinct from e.mate_l or d.expenditure_override_kcal is distinct from e.expenditure_override_kcal or d.work_effective_snapshot is distinct from e.work_effective_snapshot or d.gym_effective_snapshot is distinct from e.gym_effective_snapshot or d.work_source_snapshot is distinct from e.work_source_snapshot or d.gym_source_snapshot is distinct from e.gym_source_snapshot or g.effective_from is distinct from e.goal_effective_from or r.effective_from is distinct from e.expenditure_effective_from or s.effective_from is distinct from e.schedule_effective_from or d.nutrition_target_kcal_snapshot is distinct from e.nutrition_target_kcal_snapshot or d.protein_target_g_snapshot is distinct from e.protein_target_g_snapshot or d.water_target_l_snapshot is distinct from e.water_target_l_snapshot or d.estimated_expenditure_kcal_snapshot is distinct from e.estimated_expenditure_kcal_snapshot or d.total_calories_consumed is distinct from e.total_calories_consumed or d.total_protein_g is distinct from e.total_protein_g or d.total_carbs_g is distinct from e.total_carbs_g or d.total_fat_g is distinct from e.total_fat_g or d.delta_vs_nutrition_target is distinct from e.delta_vs_nutrition_target or d.energy_balance_kcal is distinct from e.energy_balance_kcal) then\n    raise exception 'HISTORICAL_DAY_ASSERT_FAILED';\n  end if;\n  if (select current_weight_kg from public.profiles where user_id=v_user) is distinct from ${production.profile?.current_weight_kg ?? "null"}::numeric\n    or (select bmr_kcal_current from public.profiles where user_id=v_user) is distinct from ${production.profile?.bmr_kcal_current ?? "null"} then\n    raise exception 'WEIGHT_OR_BMR_ASSERT_FAILED';\n  end if;\n  if (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.user_id::text),'')) from (select * from public.profiles) x) <> ${sqlLiteral(hashes.profiles)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_sessions) x) <> ${sqlLiteral(hashes.workout_sessions)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_session_exercises) x) <> ${sqlLiteral(hashes.workout_session_exercises)}\n    or (select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.id::text),'')) from (select * from public.workout_sets) x) <> ${sqlLiteral(hashes.workout_sets)} then\n    raise exception 'REGRESSION_HASH_ASSERT_FAILED';\n  end if;\n  if ${plan.reconciliation.exactDays} <> 29 or ${plan.reconciliation.withinToleranceDays} <> 16 or ${plan.reconciliation.sourceWinsDays} <> 1 or ${plan.reconciliation.mismatchDays} <> 0 then\n    raise exception 'RECONCILIATION_ASSERT_FAILED';\n  end if;\nend;\n$assert$;\n\nselect jsonb_build_object('validated',true,'mode',${sqlLiteral(options.mode)},'source_sha256',${sqlLiteral(plan.sourceSha256)},'import_run_id',(select import_run_id from _nutrition_import_ctx),'counts',${jsonLiteral(counts)}) result;\n${end}\n`;
}

export function buildHistoricalImportSql(options: ApplyBuildOptions): string {
  assertApplyGuards(options);
  const userId = options.production.user_id;
  if (!userId) throw new Error("El snapshot productivo no contiene user_id");
  const authenticatedContext = `select set_config('request.jwt.claims', ${sqlLiteral(JSON.stringify({ sub: userId, role: "authenticated" }))}, true);`;
  const profileStableHash = options.production.regression_hashes?.profiles_stable;
  if (!profileStableHash) throw new Error("Falta el hash estable de profiles");
  let sql = buildHistoricalImportSqlWithoutSession(options).replace(
    "set local statement_timeout = '300s';",
    `set local statement_timeout = '300s';\n${authenticatedContext}`,
  );
  const fullProfileCheck = `(select md5(coalesce(string_agg(row_to_json(x)::text,'' order by x.user_id::text),'')) from (select * from public.profiles) x) <> ${sqlLiteral(options.production.regression_hashes!.profiles)}`;
  const stableProfileCheck = `(select md5(coalesce(string_agg((to_jsonb(x)-'updated_at')::text,'' order by x.user_id::text),'')) from (select * from public.profiles) x) <> ${sqlLiteral(profileStableHash)}`;
  const finalProfileCheck = sql.lastIndexOf(fullProfileCheck);
  if (finalProfileCheck < 0) throw new Error("No se encontró el assert final de profiles");
  sql = `${sql.slice(0, finalProfileCheck)}${stableProfileCheck}${sql.slice(finalProfileCheck + fullProfileCheck.length)}`;
  return sql;
}
