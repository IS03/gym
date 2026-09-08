-- PR71 follow-up: cubrir también la FK directa y las lecturas por usuario.
begin;

create index idx_nutrition_plan_weekdays_user_plan
  on public.nutrition_plan_weekdays (user_id, plan_id);

commit;
