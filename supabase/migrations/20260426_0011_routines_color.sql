-- Entrenamiento: color opcional por rutina (para calendario).
begin;

alter table public.routines
  add column if not exists color text;

-- Formato esperado: hex corto/largo (#RGB o #RRGGBB)
alter table public.routines
  drop constraint if exists routines_color_format_check;
alter table public.routines
  add constraint routines_color_format_check
  check (
    color is null
    or color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'
  );

commit;

