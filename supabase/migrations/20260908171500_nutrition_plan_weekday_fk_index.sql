-- PR71 follow-up: alinear el índice hijo con el orden de la FK compuesta.
begin;

drop index public.idx_nutrition_plan_weekdays_user_plan;
create index idx_nutrition_plan_weekdays_plan_user
  on public.nutrition_plan_weekdays (plan_id, user_id);

commit;
