-- Issue #29, fase 1: los índices deben cubrir las dos columnas de las FKs
-- compuestas que también validan ownership. No modifica filas ni semántica.
begin;

drop index if exists public.idx_day_logs_nutrition_goal_period;
create index idx_day_logs_nutrition_goal_period
on public.day_logs (nutrition_goal_period_id, user_id)
where nutrition_goal_period_id is not null;

drop index if exists public.idx_day_logs_expenditure_rule_period;
create index idx_day_logs_expenditure_rule_period
on public.day_logs (expenditure_rule_period_id, user_id)
where expenditure_rule_period_id is not null;

drop index if exists public.idx_day_logs_work_schedule_period;
create index idx_day_logs_work_schedule_period
on public.day_logs (work_schedule_period_id, user_id)
where work_schedule_period_id is not null;

commit;
