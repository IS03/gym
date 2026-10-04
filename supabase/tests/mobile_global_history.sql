-- Run after M6 EXPAND. Entire fixture and privilege probes roll back.
begin;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into auth.users(id,email) values
 ('61000000-0000-4000-8000-000000000001','m6-rollback-owner@example.invalid'),
 ('61000000-0000-4000-8000-000000000002','m6-rollback-other@example.invalid');
insert into public.profiles(user_id) values ('61000000-0000-4000-8000-000000000001'),('61000000-0000-4000-8000-000000000002');
insert into public.day_logs(user_id,log_date)
select '61000000-0000-4000-8000-000000000001'::uuid, (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-i
from generate_series(0,12) i;
-- Raw day/snapshots/config must not be activity.
update public.day_logs set nutrition_target_kcal_snapshot=1800,estimated_expenditure_kcal_snapshot=2200,
 work_effective_snapshot=false,work_source_snapshot='schedule' where user_id='61000000-0000-4000-8000-000000000001';
update public.day_logs set work_override=false,work_override_source='manual',work_override_reason='fixture'
where user_id='61000000-0000-4000-8000-000000000001' and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-1;
update public.day_logs set weight_kg=0 where user_id='61000000-0000-4000-8000-000000000001'
 and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-2;
insert into public.body_measurements(user_id,measured_on,waist_cm,quality_status,quality_note,legacy_import_source,legacy_import_id)
values ('61000000-0000-4000-8000-000000000001',(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-3,80,'suspect','fixture','fixture','1');
-- >1000 metrics, including explicit zero. Custom metrics do not mirror into day_logs.
insert into public.user_metrics(user_id,name,value_type,is_active,archived_at)
select '61000000-0000-4000-8000-000000000001'::uuid,'fixture '||i,'integer',i<>1,case when i=1 then now() end from generate_series(1,1001) i;
insert into public.daily_metric_values(user_id,metric_id,metric_date,value)
select user_id,id,(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-4,0 from public.user_metrics
where user_id='61000000-0000-4000-8000-000000000001' and system_key is null;
insert into public.daily_metric_values(user_id,metric_id,metric_date,value)
select user_id,id,(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date,0 from public.user_metrics
where user_id='61000000-0000-4000-8000-000000000001' and not is_active;
insert into public.meal_entries(user_id,day_log_id,final_calories,source_type)
select user_id,id,200,'manual' from public.day_logs where user_id='61000000-0000-4000-8000-000000000001'
 and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-5;
insert into public.meal_entries(user_id,day_log_id,final_calories,source_type,precision_level,entry_kind,legacy_import_source,legacy_import_id)
select user_id,id,0,'sheet_import','historical','legacy_daily_summary','fixture','summary' from public.day_logs
where user_id='61000000-0000-4000-8000-000000000001' and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-6;
insert into public.meal_entries(user_id,day_log_id,final_calories,deleted_at)
select user_id,id,200,now() from public.day_logs where user_id='61000000-0000-4000-8000-000000000001'
 and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-7;
insert into public.workout_sessions(user_id,day_log_id,status,started_at,ended_at)
select user_id,id,'discarded',now()-interval '1 hour',now() from public.day_logs where user_id='61000000-0000-4000-8000-000000000001'
 and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-8;
insert into public.workout_sessions(user_id,day_log_id,status,started_at)
select user_id,id,'in_progress',now() from public.day_logs where user_id='61000000-0000-4000-8000-000000000001'
 and log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-9;
-- Cross-midnight timestamps deliberately differ from canonical day; total exceeds any REST cap/preview.
insert into public.workout_sessions(user_id,day_log_id,status,started_at,ended_at)
select d.user_id,d.id,'completed',d.log_date+time '23:30' at time zone 'America/Argentina/Cordoba',
 (d.log_date+1)+time '00:30' at time zone 'America/Argentina/Cordoba'
from public.day_logs d cross join generate_series(1,1002) i where d.user_id='61000000-0000-4000-8000-000000000001'
 and d.log_date=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-10;
-- Mixed day uses genuine records from separate owners, not configuration.
insert into public.body_measurements(user_id,measured_on,waist_cm) values ('61000000-0000-4000-8000-000000000001',(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-1,81);
-- Foreign facts must not leak.
insert into public.day_logs(user_id,log_date,weight_kg) values ('61000000-0000-4000-8000-000000000002',(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-12,90);
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare t date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date; r jsonb; f jsonb; b jsonb; snap jsonb; before_days bigint; before_definitions bigint;
begin
 select count(*) into before_days from public.day_logs;
 select count(*) into before_definitions from public.user_metrics;
 r := public.mobile_read_history_range(t-12,t);
 assert jsonb_array_length(r->'days')=13, 'dense range';
 assert (r->'days'->2->>'completedSessionsCount')::int=1002, 'completed total and cross-midnight log_date';
 assert (r->'days'->3->>'completedSessionsCount')::int=0, 'active excluded';
 assert (r->'days'->4->>'completedSessionsCount')::int=0, 'discard excluded';
 assert (r->'days'->5->>'nutritionEntriesCount')::int=0, 'deleted excluded';
 assert (r->'days'->6->>'nutritionEntriesCount')::int=1, 'legacy zero summary';
 assert (r->'days'->7->>'nutritionEntriesCount')::int=1, 'meal';
 assert (r->'days'->8->>'metricValuesCount')::int=1001, 'more than REST cap';
 assert (r->'days'->9->>'measurementsCount')::int=1, 'measurement only';
 assert (r->'days'->10->>'hasWeight')::boolean, 'zero weight is still a fact';
 assert (r->'days'->11->>'hasExplicitOverrides')::boolean and (r->'days'->11->>'measurementsCount')::int=1, 'explicit false work override and mixed sources';
 assert not (r->'days'->0->>'hasWeight')::boolean, 'foreign ownership';
 f := r->'days'->1;
 assert f->>'completedSessionsCount'='0' and f->>'nutritionEntriesCount'='0' and f->>'metricValuesCount'='0'
 and f->>'measurementsCount'='0' and f->>'hasWeight'='false' and f->>'hasExplicitOverrides'='false', 'snapshots/raw log not activity';
 assert jsonb_array_length(public.mobile_read_history_range()->'days')=30, 'default30';
 assert jsonb_array_length(public.mobile_read_history_range(t-61,t)->'days')=62, 'max62';
 assert public.mobile_read_history_range(t-1,t+1)->'effectiveRange'->>'to'=t::text, 'future trim';
 begin perform public.mobile_read_history_range(t-62,t); raise exception 'accepted oversized range'; exception when sqlstate '22023' then null; end;
 begin perform public.mobile_read_history_range(t+1,t+2); raise exception 'accepted future'; exception when sqlstate '22023' then null; end;
 begin perform public.mobile_read_history_range(t,null); raise exception 'accepted half range'; exception when sqlstate '22023' then null; end;
 b := public.mobile_read_body_day(t-2); assert (b->'weight'->'data'->>'weightKg')::numeric=0, 'exact zero weight';
 b := public.mobile_read_body_day(t-3); assert b->'weight'->'data'='null'::jsonb, 'no latest weight substitute';
 assert b->'measurement'->'data'->>'qualityStatus'='suspect' and (b->'measurement'->'data'->>'imported')::boolean, 'quality/import preserved';
 assert public.mobile_read_body_measurement((b->'measurement'->'data'->>'id')::uuid)=b->'measurement'->'data', 'identity baseline';
 snap := public.mobile_read_nutrition_day(t);
 assert exists (select from jsonb_array_elements(snap->'activity'->'data'->'metrics') m where m->>'isActive'='false' and (m->>'value')::numeric=0), 'archived today visible';
 snap := public.mobile_read_nutrition_day(t-4);
 assert exists (select from jsonb_array_elements(snap->'activity'->'data'->'metrics') m where m->>'isActive'='false' and (m->>'value')::numeric=0), 'archived historical';
 perform public.mobile_read_nutrition_day(t-1000); perform public.mobile_read_body_day(t-1000); perform public.mobile_read_history_range(t-61,t);
 assert (select count(*) from public.day_logs)=before_days and (select count(*) from public.user_metrics)=before_definitions, 'no read materialization/ensure';
 assert not has_function_privilege('anon','public.mobile_read_history_range(date,date)','execute'), 'anon revoked';
 assert (select count(*) from public.day_logs where user_id='61000000-0000-4000-8000-000000000002')=0, 'RLS';
end;
$$;
reset role;
-- Removing the last preserved fact makes that date inactive without deleting its day_log.
delete from public.body_measurements where user_id='61000000-0000-4000-8000-000000000001' and measured_on=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date-3;
set local role authenticated;
do $$ declare r jsonb; t date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date; begin r:=public.mobile_read_history_range(t-3,t-3); assert r->'days'->0->>'measurementsCount'='0'; assert r->'days'->0->>'hasExplicitOverrides'='false'; end $$;
reset role;
-- Each source permission failure remains null while independent facts survive.
revoke select on public.workout_sessions from authenticated;
set local role authenticated;
do $$ declare r jsonb; begin r:=public.mobile_read_history_range(); assert r->'availability'->>'training'='unavailable'; assert r->'days'->0->'completedSessionsCount'='null'::jsonb; assert r->'availability'->>'metrics'='ok'; end $$;
reset role; grant select on public.workout_sessions to authenticated;
revoke select on public.meal_entries from authenticated;
set local role authenticated;
do $$ declare r jsonb; begin r:=public.mobile_read_history_range(); assert r->'availability'->>'nutrition'='unavailable'; assert r->'availability'->>'training'='ok'; assert r->'availability'->>'weight'='ok'; end $$;
reset role; grant select on public.meal_entries to authenticated;
revoke select on public.body_measurements from authenticated;
set local role authenticated;
do $$ declare r jsonb; begin r:=public.mobile_read_history_range(); assert r->'availability'->>'measurements'='unavailable'; assert r->'availability'->>'metrics'='ok'; end $$;
reset role; grant select on public.body_measurements to authenticated;
revoke select on public.daily_metric_values from authenticated;
set local role authenticated;
do $$ declare r jsonb; begin r:=public.mobile_read_history_range(); assert r->'availability'->>'metrics'='unavailable'; assert r->'availability'->>'weight'='ok'; end $$;
reset role; grant select on public.daily_metric_values to authenticated;
revoke select on public.day_logs from authenticated;
set local role authenticated;
do $$ declare r jsonb; begin r:=public.mobile_read_history_range(); assert r->'availability'->>'weight'='unavailable'; assert r->'availability'->>'measurements'='ok'; assert r->'availability'->>'metrics'='ok'; end $$;
reset role;
rollback;
select 'M6 discovery/range/RLS/read-only/availability assertions passed; fixtures rolled back' as result;
