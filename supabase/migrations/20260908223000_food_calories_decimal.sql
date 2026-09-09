alter table public.foods
  alter column calories type numeric(10, 2)
  using calories::numeric(10, 2);
