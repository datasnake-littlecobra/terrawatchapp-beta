-- TerraWatch — Phase 9.13: API keys for the Insurance Risk API.
--
-- Stores HASHED keys only — the raw key is shown once at creation time
-- and never recoverable from the database. Hash is sha256 hex. Prefix
-- is the first 8 chars of the raw key, stored in cleartext for
-- display ("tw_abc12def…") so admins can identify a key without ever
-- exposing the secret.
--
-- Per-day usage is bucketed into api_key_usage (one row per key per
-- UTC day). Rate limiting is enforced inside the Edge Function by
-- comparing today's count to api_keys.daily_limit. We don't write
-- one row per request — that would balloon. One row per key-day plus
-- an atomic increment via a SECURITY DEFINER RPC.
--
-- Admin-only writes via is_admin() RPC (same pattern as the blog
-- generator). Reads are also admin-only — the Edge Function uses the
-- service role to bypass RLS.

-- 1. Tables ----------------------------------------------------------

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  key_hash      text not null unique,
  key_prefix    text not null,
  tenant_name   text not null,
  plan          text not null check (plan in ('free','paid')) default 'free',
  daily_limit   int  not null check (daily_limit > 0)         default 100,
  created_by    uuid references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  note          text
);

comment on table public.api_keys is
  'Per-tenant API keys for the Insurance Risk API. Raw key is sha256-hashed; prefix kept cleartext for display.';

create index if not exists api_keys_active_idx on public.api_keys (key_hash) where revoked_at is null;

create table if not exists public.api_key_usage (
  key_id uuid not null references public.api_keys on delete cascade,
  day    date not null,
  count  int  not null default 0 check (count >= 0),
  primary key (key_id, day)
);

comment on table public.api_key_usage is
  'Per-key per-UTC-day request count. Enforces daily_limit inside the Edge Function.';

-- 2. RLS -------------------------------------------------------------

alter table public.api_keys      enable row level security;
alter table public.api_key_usage enable row level security;

-- Admin-only via the role helper. Same shape as user_profiles policies.
create policy "admin read api_keys"
  on public.api_keys
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

create policy "admin write api_keys"
  on public.api_keys
  for all
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

create policy "admin read api_key_usage"
  on public.api_key_usage
  for select
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

-- 3. SECURITY DEFINER RPCs -------------------------------------------

-- Atomic "is this key valid + under quota, and if so bump the counter?"
-- Called by the Edge Function on every API request via the service role.
-- Returns (allowed boolean, key_id uuid, tenant_name text, plan text,
--          remaining int, daily_limit int).
create or replace function public.api_key_check_and_bump(p_key_hash text)
returns table (
  allowed     boolean,
  key_id      uuid,
  tenant_name text,
  plan        text,
  remaining   int,
  daily_limit int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.api_keys%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_count int;
begin
  select * into v_row
  from public.api_keys
  where key_hash = p_key_hash
    and revoked_at is null
  limit 1;

  if not found then
    return query select false, null::uuid, ''::text, ''::text, 0, 0;
    return;
  end if;

  -- Upsert today's counter row and read it back.
  insert into public.api_key_usage (key_id, day, count)
  values (v_row.id, v_today, 1)
  on conflict (key_id, day)
    do update set count = public.api_key_usage.count + 1
  returning count into v_count;

  -- Quota check happens after the bump for atomicity. If over-quota,
  -- the row is still incremented (so a flood of over-quota requests
  -- shows up in usage) but the response is "denied".
  if v_count > v_row.daily_limit then
    return query
      select false, v_row.id, v_row.tenant_name, v_row.plan,
             0, v_row.daily_limit;
    return;
  end if;

  update public.api_keys
    set last_used_at = now()
    where id = v_row.id;

  return query
    select true, v_row.id, v_row.tenant_name, v_row.plan,
           greatest(v_row.daily_limit - v_count, 0), v_row.daily_limit;
end;
$$;

revoke all on function public.api_key_check_and_bump(text) from public;
grant execute on function public.api_key_check_and_bump(text) to service_role;

comment on function public.api_key_check_and_bump(text) is
  'Edge-function entry point. Validates a key hash, bumps the daily counter, returns quota state.';
