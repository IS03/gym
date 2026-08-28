-- Fase 1: perfil como fuente de cálculo (peso/actividad/objetivo controlados).
begin;

alter table public.profiles
  add column if not exists current_weight_kg numeric(6,2) check (
    current_weight_kg is null or (current_weight_kg >= 0 and current_weight_kg <= 999.99)
  );

-- Normalizamos valores esperados (sin romper datos existentes si son null).
alter table public.profiles
  drop constraint if exists profiles_activity_level_check;
alter table public.profiles
  add constraint profiles_activity_level_check check (
    activity_level is null or activity_level in (
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_goal_type_check;
alter table public.profiles
  add constraint profiles_goal_type_check check (
    goal_type is null or goal_type in ('lose', 'maintain', 'gain')
  );

commit;

