-- PR22: reemplaza auth.role() por RLS + privilegios de columna.
begin;

drop trigger if exists tr_integration_api_tokens_protect_update
on public.integration_api_tokens;

drop function if exists public.integration_api_tokens_protect_update();

drop policy if exists integration_api_tokens_revoke_own
on public.integration_api_tokens;

create policy integration_api_tokens_revoke_own
on public.integration_api_tokens for update to authenticated
using (
  (select auth.uid()) = user_id
  and revoked_at is null
)
with check (
  (select auth.uid()) = user_id
  and revoked_at is not null
);

revoke insert, update on table public.integration_api_tokens
from authenticated;

grant insert (
  user_id, token_hash, token_prefix, label, scope
) on public.integration_api_tokens to authenticated;

grant update (revoked_at)
on public.integration_api_tokens to authenticated;

comment on policy integration_api_tokens_revoke_own
on public.integration_api_tokens is
  'El owner sólo puede revocar una credencial activa; los demás campos se protegen con privilegios de columna.';

commit;
