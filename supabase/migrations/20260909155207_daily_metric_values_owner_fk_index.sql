create index daily_metric_values_metric_owner_idx
on public.daily_metric_values(metric_id, user_id);
