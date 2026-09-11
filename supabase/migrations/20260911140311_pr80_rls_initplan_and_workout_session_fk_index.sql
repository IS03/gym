-- Keep the existing owner-only semantics while evaluating auth.uid() once per
-- statement instead of once per row (Supabase Performance Advisor initplan).
alter policy profiles_select_own
  on public.profiles
  using ((select auth.uid()) = user_id);

alter policy profiles_insert_own
  on public.profiles
  with check ((select auth.uid()) = user_id);

alter policy profiles_update_own
  on public.profiles
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy day_logs_select_own
  on public.day_logs
  using ((select auth.uid()) = user_id);

alter policy day_logs_insert_own
  on public.day_logs
  with check ((select auth.uid()) = user_id);

alter policy day_logs_update_own
  on public.day_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy meal_entries_select_own
  on public.meal_entries
  using ((select auth.uid()) = user_id);

alter policy meal_entries_insert_own
  on public.meal_entries
  with check ((select auth.uid()) = user_id);

alter policy meal_entries_update_own
  on public.meal_entries
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists idx_workout_sessions_routine_id
  on public.workout_sessions (routine_id);
