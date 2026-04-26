-- Normalización a MAYÚSCULAS para textos de comidas (Fase 1).
-- Aplica a: meal_entries.title, meal_entries.description, meal_entries.notes y day_logs.notes.
begin;

-- Reutilizamos public.normalize_name() (trim + colapsa espacios + UPPER) creado en 0012.
-- Si por algún motivo no existiera, la migración fallará explícitamente.

-- Backfill existentes
update public.meal_entries
set
  title = case when title is null then null else public.normalize_name(title) end,
  description = case when description is null then null else public.normalize_name(description) end
where title is not null or description is not null;

-- notes puede no existir según el estado del schema: lo normalizamos solo si está.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'meal_entries'
      and column_name = 'notes'
  ) then
    execute $sql$
      update public.meal_entries
      set notes = case when notes is null then null else public.normalize_name(notes) end
      where notes is not null;
    $sql$;
  end if;
end $$;

update public.day_logs
set notes = case when notes is null then null else public.normalize_name(notes) end
where notes is not null;

-- Trigger para normalizar en insert/update
create or replace function public.trg_meal_entries_normalize_text()
returns trigger
language plpgsql
as $$
begin
  if new.title is not null then
    new.title := public.normalize_name(new.title);
  end if;
  if new.description is not null then
    new.description := public.normalize_name(new.description);
  end if;
  -- new.notes puede no existir en algunos schemas; por eso la dejamos afuera
  return new;
end;
$$;

drop trigger if exists tr_meal_entries_normalize_text on public.meal_entries;
create trigger tr_meal_entries_normalize_text
before insert or update of title, description on public.meal_entries
for each row
execute function public.trg_meal_entries_normalize_text();

create or replace function public.trg_day_logs_normalize_notes()
returns trigger
language plpgsql
as $$
begin
  if new.notes is not null then
    new.notes := public.normalize_name(new.notes);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_day_logs_normalize_notes on public.day_logs;
create trigger tr_day_logs_normalize_notes
before insert or update of notes on public.day_logs
for each row
execute function public.trg_day_logs_normalize_notes();

commit;

