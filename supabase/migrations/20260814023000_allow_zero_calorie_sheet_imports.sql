-- Los registros históricos pueden representar consumos de cero calorías
-- (por ejemplo, hidratación). El flujo manual conserva su requisito > 0.
begin;

alter table public.meal_entries
  drop constraint if exists meal_entries_final_calories_required;

alter table public.meal_entries
  add constraint meal_entries_final_calories_required check (
    deleted_at is not null
    or (
      final_calories is not null
      and (
        final_calories > 0
        or (source_type = 'sheet_import' and final_calories = 0)
      )
    )
  ) not valid;

commit;
