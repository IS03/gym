-- Normalización definitiva de nombres: trim + colapsar espacios + MAYÚSCULAS.
-- Aplica a exercises.nombre y routines.nombre.
begin;

create or replace function public.normalize_name(p text)
returns text
language sql
immutable
as $$
  select nullif(upper(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$$;

-- Backfill: normaliza lo existente
update public.exercises
set nombre = public.normalize_name(nombre)
where nombre is not null;

update public.routines
set nombre = public.normalize_name(nombre)
where nombre is not null;

commit;

