-- Fase 1 simplificada: sin borradores/estados/confirmación.
-- Reglas:
-- - toda comida activa (deleted_at is null) cuenta para el día
-- - calorías obligatorias > 0 (para activas)
begin;

-- Drop índice parcial que dependía de status.
drop index if exists public.idx_meal_entries_active_confirmed;

-- Recrear índice útil para queries por día (activas).
create index if not exists idx_meal_entries_active
on public.meal_entries(day_log_id)
where deleted_at is null;

-- Ajustar el recálculo: ya no filtra por status
create or replace function public.recalculate_day_log(p_day_log_id uuid)
returns void
language plpgsql
as $$
declare
  v_total_kcal integer;
  v_total_protein numeric(8,2);
  v_target integer;
  v_maint integer;
begin
  select
    coalesce(sum(final_calories), 0)::integer,
    coalesce(sum(final_protein_g), 0)::numeric(8,2)
  into v_total_kcal, v_total_protein
  from public.meal_entries
  where day_log_id = p_day_log_id
    and deleted_at is null;

  select target_kcal_snapshot, maintenance_kcal_snapshot
  into v_target, v_maint
  from public.day_logs
  where id = p_day_log_id;

  update public.day_logs
  set
    total_calories_consumed = v_total_kcal,
    total_protein_g = v_total_protein,
    delta_vs_target = case when v_target is null then null else v_total_kcal - v_target end,
    delta_vs_maintenance = case when v_maint is null then null else v_total_kcal - v_maint end,
    updated_at = now()
  where id = p_day_log_id;
end;
$$;

-- Eliminar columna status + tipo enum
alter table public.meal_entries drop column if exists status;
drop type if exists public.meal_entry_status;

commit;

