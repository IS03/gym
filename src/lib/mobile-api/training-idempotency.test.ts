import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260927190000_mobile_training_api_expand.sql";
const sql = readFileSync(migrationPath, "utf8");

describe("M3.1 Mobile Training idempotency migration", () => {
  it("is additive and creates the user-scoped 30-day ledger", () => {
    expect(sql).toContain("create table public.mobile_idempotency_keys");
    expect(sql).toContain("primary key (user_id, operation, idempotency_key)");
    expect(sql).toContain("request_hash ~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("now() + interval '30 days'");
    expect(sql).toContain("mobile_idempotency_keys_expires_at_idx");
    expect(sql).not.toMatch(/drop\s+table/i);
  });

  it("denies direct ledger access and exposes only authenticated RPC execution", () => {
    expect(sql).toContain("alter table public.mobile_idempotency_keys enable row level security");
    expect(sql).toContain(
      "revoke all on table public.mobile_idempotency_keys from public, anon, authenticated",
    );
    expect(sql).not.toMatch(/create policy[\s\S]+mobile_idempotency_keys/i);
    expect(sql).toMatch(/revoke all on function public\.mobile_create_training_routine[\s\S]+from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.mobile_create_training_routine[\s\S]+to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.mobile_create_training_exercise[\s\S]+to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.mobile_update_training_exercise[\s\S]+to authenticated/i);
  });

  it("uses controlled security-definer RPCs with server-derived identity", () => {
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(3);
    expect(sql.match(/v_user_id uuid := \(select auth\.uid\(\)\)/g)).toHaveLength(3);
    expect(sql).not.toContain("p_user_id");
    expect(sql).not.toContain("service_role");
    expect(sql.match(/if v_user_id is null then/g)).toHaveLength(3);
  });

  it("scopes keys and domain ownership to the authenticated user", () => {
    expect(sql).toContain("primary key (user_id, operation, idempotency_key)");
    expect((sql.match(/where user_id = v_user_id/g) ?? []).length)
      .toBeGreaterThanOrEqual(4);
    expect(sql).toContain("r.user_id = v_user_id");
    expect(sql).toContain("values (v_user_id, v_name, p_color, true)");
    expect(sql).toContain("v_user_id, v_name, v_muscle_group");
  });

  it("hashes canonical payloads, serializes concurrent claims, and replays stored responses", () => {
    expect(sql.match(/public\.digest\(/g)).toHaveLength(2);
    expect(sql.match(/on conflict \(user_id, operation, idempotency_key\) do nothing/g)).toHaveLength(2);
    expect(sql.match(/for update;/g)).toHaveLength(4);
    expect(sql.match(/v_ledger\.state = 'completed'/g)).toHaveLength(2);
    expect(sql.match(/v_ledger\.response_status, v_ledger\.response_body, true/g)).toHaveLength(2);
    expect(sql).toContain("select coalesce(array_agg(distinct item order by item)");
  });

  it("rejects hash mismatch without duplicating resources", () => {
    expect(sql.match(/v_ledger\.request_hash <> v_request_hash/g)).toHaveLength(2);
    expect(sql.match(/IDEMPOTENCY_KEY_REUSED/g)).toHaveLength(2);
    expect(sql).toContain("training.routine.create.v1");
    expect(sql).toContain("training.exercise.create.v1");
  });

  it("stores the exercise partial-membership warning for exact replay", () => {
    expect(sql).toContain("exception when others then");
    expect(sql).toContain("Ejercicio creado. No pudo agregarse a la rutina");
    expect(sql).toContain("v_response := v_response || jsonb_build_object('warning', v_warning)");
    expect(sql).toContain("response_body = v_response");
  });

  it("validates direct exercise JSON types and rejects unknown properties before casts", () => {
    expect(sql.match(/pg_catalog\.jsonb_object_keys\(p_exercise\)/g)).toHaveLength(2);
    expect(sql.match(/pg_catalog\.jsonb_typeof\(p_exercise -> 'name'\) <> 'string'/g))
      .toHaveLength(2);
    expect(sql.match(/not in \('number', 'null'\)/g)).toHaveLength(2);
    expect(sql.match(/not in \('string', 'null'\)/g)).toHaveLength(2);
    expect(sql).toContain("v_suggested_sets_number <> trunc(v_suggested_sets_number)");
    expect(sql).toContain("El ejercicio contiene propiedades no permitidas.");
    const createStart = sql.indexOf("create function public.mobile_create_training_exercise");
    const updateStart = sql.indexOf("create function public.mobile_update_training_exercise");
    const createSql = sql.slice(createStart, updateStart);
    expect(createSql.indexOf("not in ('number', 'null')"))
      .toBeLessThan(createSql.indexOf("v_suggested_sets_number :="));
    expect(createSql.indexOf("not in ('string', 'null')"))
      .toBeLessThan(createSql.indexOf("v_notes :="));
  });

  it("updates exercise fields and desired memberships in one invoker transaction", () => {
    expect(sql).toContain("create function public.mobile_update_training_exercise");
    expect(sql).toMatch(/mobile_update_training_exercise[\s\S]+security invoker/);
    expect(sql).toMatch(/mobile_update_training_exercise[\s\S]+for update;/);
    expect(sql).toMatch(/mobile_update_training_exercise[\s\S]+update public\.exercises[\s\S]+delete from public\.routine_exercises[\s\S]+insert into public\.routine_exercises/);
    expect(sql).toContain("TRAINING_EXERCISE_NOT_FOUND");
    expect(sql).toContain("Una rutina seleccionada no existe, es ajena o está archivada.");
  });

  it("keeps rollback atomic and documents bounded completed-row cleanup", () => {
    expect(sql.startsWith("-- M3.1A")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("delete only");
    expect(sql).toContain("completed rows");
    expect(sql).toContain("bounded batches");
  });
});
