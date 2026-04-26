-- Fase 1: calorías obligatorias y > 0 en meal_entries.
-- CHECK NOT VALID: aplica a filas nuevas/updates sin romper datos viejos.
begin;

alter table public.meal_entries
  drop constraint if exists meal_entries_final_calories_required;

alter table public.meal_entries
  add constraint meal_entries_final_calories_required
  check (deleted_at is not null or (final_calories is not null and final_calories > 0)) not valid;

commit;

