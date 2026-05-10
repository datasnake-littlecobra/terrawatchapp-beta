-- TerraWatch — Phase 9.8 follow-up: server-side admin code validator.
--
-- The `redeem_admin_code` RPC in migration 0018 requires an authenticated
-- caller — fine for the "promote existing logged-in user" path, but it
-- doesn't help when the user doesn't have an account yet AND can't get
-- one because Supabase email confirmation is gating their sign-in.
--
-- This RPC validates the admin code against the same Vault secret WITHOUT
-- requiring auth.uid(). It is intentionally locked to service-role only:
-- the supabase/functions/signup-admin edge function calls it after
-- validating its own anonymous request body. Direct PostgREST calls from
-- the browser are blocked by the revoke + the lack of grants below.

create or replace function public.check_admin_signup_code(submitted_code text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  if submitted_code is null or submitted_code = '' then
    return false;
  end if;

  select decrypted_secret into expected
    from vault.decrypted_secrets
    where name = 'admin_signup_code'
    limit 1;

  if expected is null or expected = '' then
    return false;
  end if;

  return submitted_code = expected;
end;
$$;

revoke all on function public.check_admin_signup_code(text) from public, anon, authenticated;
-- service_role keeps EXECUTE because it owns all functions by default.
