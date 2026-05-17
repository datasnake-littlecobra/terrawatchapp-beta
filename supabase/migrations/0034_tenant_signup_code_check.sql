-- TerraWatch — Phase 9.16.0: optional tenant signup code validator.
--
-- Mirrors the check_admin_signup_code pattern from 0021. The
-- signup-tenant Edge Function calls this to validate the optional
-- beta_code field. If the Vault secret 'tenant_signup_code' is
-- NOT set, the function runs open (returns true for any code) so
-- you can ship without configuring it. Set the Vault secret when
-- you want to gate signups.
--
-- Service-role only — direct PostgREST calls from the browser are
-- blocked by the revoke + the lack of grants below.

create or replace function public.check_tenant_signup_code(submitted_code text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  expected text;
begin
  select decrypted_secret into expected
    from vault.decrypted_secrets
    where name = 'tenant_signup_code'
    limit 1;

  -- If no Vault secret is configured, the gate is open. Lets you
  -- ship the bypass without forcing a Vault edit first.
  if expected is null or expected = '' then
    return true;
  end if;

  if submitted_code is null or submitted_code = '' then
    return false;
  end if;

  return submitted_code = expected;
end;
$$;

revoke all on function public.check_tenant_signup_code(text) from public, anon, authenticated;
-- service_role keeps EXECUTE by default.

comment on function public.check_tenant_signup_code(text) is
  'Phase 9.16.0 — optional Vault-backed gate for tenant signup. Returns true if no Vault secret is set (open mode).';
