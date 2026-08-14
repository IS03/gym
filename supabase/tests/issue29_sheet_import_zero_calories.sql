begin;

do $test$
declare
  v_user uuid := gen_random_uuid();
  v_day uuid := gen_random_uuid();
begin
  insert into auth.users (id) values (v_user);
  insert into public.profiles (user_id) values (v_user);
  insert into public.day_logs (id, user_id, log_date) values (v_day, v_user, date '2026-01-01');

  insert into public.meal_entries (
    user_id, day_log_id, consumed_at, title, final_calories, source_type
  ) values (
    v_user, v_day, timestamptz '2026-01-01 15:00:00+00', 'Hidratación histórica', 0, 'sheet_import'
  );

  begin
    insert into public.meal_entries (
      user_id, day_log_id, consumed_at, title, final_calories, source_type
    ) values (
      v_user, v_day, timestamptz '2026-01-01 16:00:00+00', 'Comida manual inválida', 0, 'manual'
    );
    raise exception 'Una comida manual de cero calorías debió ser rechazada';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.meal_entries (
      user_id, day_log_id, consumed_at, title, final_calories, source_type
    ) values (
      v_user, v_day, timestamptz '2026-01-01 17:00:00+00', 'Import inválido', -1, 'sheet_import'
    );
    raise exception 'Una importación con calorías negativas debió ser rechazada';
  exception
    when check_violation then null;
  end;
end;
$test$;

rollback;
