-- PR19: prevent caller-controlled search_path resolution without replacing
-- function bodies or changing their SECURITY INVOKER semantics and grants.
alter function public.normalize_name(text) set search_path = '';
alter function public.routine_exercises_enforce_owner_min() set search_path = '';
alter function public.trg_day_logs_normalize_notes() set search_path = '';
alter function public.trg_exercises_normalize_nombre() set search_path = '';
alter function public.trg_meal_entries_normalize_text() set search_path = '';
alter function public.trg_routines_normalize_nombre() set search_path = '';
alter function public.trg_workout_session_exercises_completion() set search_path = '';
alter function public.trg_workout_session_exercises_init() set search_path = '';
alter function public.workout_sessions_sync_user_id() set search_path = '';
