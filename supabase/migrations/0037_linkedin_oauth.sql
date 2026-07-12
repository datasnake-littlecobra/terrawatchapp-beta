-- TerraWatch — Phase 9.17.1: LinkedIn OAuth token storage.
--
-- The DataSnake LinkedIn company page admin authorizes our app via
-- OAuth. The exchange yields an access_token (60-day lifetime) + a
-- refresh_token (365-day lifetime). Both are stored here. The
-- publish-linkedin-post Edge Function reads tokens via the service
-- role and rotates them when LinkedIn returns 401.
--
-- One row per LinkedIn organization. We expect exactly one (DataSnake)
-- but the schema supports multi-org for future expansion.

create table if not exists public.linkedin_oauth (
  id                        uuid primary key default gen_random_uuid(),
  org_urn                   text not null unique,                    -- 'urn:li:organization:12345'
  org_name                  text,                                     -- 'DataSnake' (cached for UI display)
  org_vanity_name           text,                                     -- 'datasnake' (URL slug)
  access_token              text not null,
  refresh_token             text not null,
  access_token_expires_at   timestamptz not null,
  refresh_token_expires_at  timestamptz not null,
  scope                     text,                                     -- granted scopes, space-separated
  connected_at              timestamptz not null default now(),
  connected_by              uuid references auth.users on delete set null,
  updated_at                timestamptz not null default now()
);

create index if not exists linkedin_oauth_org_urn_idx on public.linkedin_oauth (org_urn);

alter table public.linkedin_oauth enable row level security;

-- Service role only — admins do NOT read tokens directly. They see
-- redacted connection status via the linkedin_oauth_status() RPC.
-- No SELECT policy means anon + authenticated get nothing back.
-- Service role bypasses RLS so the Edge Functions can read/write.

-- =====================================================================
-- linkedin_oauth_status — redacted view for the admin UI
-- =====================================================================

create or replace function public.linkedin_oauth_status()
returns table (
  connected                  boolean,
  org_urn                    text,
  org_name                   text,
  org_vanity_name            text,
  access_token_expires_at    timestamptz,
  refresh_token_expires_at   timestamptz,
  scope                      text,
  connected_at               timestamptz,
  connected_by_email         text,
  needs_refresh              boolean,
  needs_reconnect            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with row as (
    select * from public.linkedin_oauth order by connected_at desc limit 1
  )
  select
    (r.org_urn is not null)                                              as connected,
    r.org_urn,
    r.org_name,
    r.org_vanity_name,
    r.access_token_expires_at,
    r.refresh_token_expires_at,
    r.scope,
    r.connected_at,
    (select u.email::text from auth.users u where u.id = r.connected_by) as connected_by_email,
    (r.access_token_expires_at  < now() + interval '7 days')             as needs_refresh,
    (r.refresh_token_expires_at < now() + interval '30 days')            as needs_reconnect
  from row r;
$$;

grant execute on function public.linkedin_oauth_status() to authenticated;

comment on table public.linkedin_oauth is
  'Phase 9.17.1 — LinkedIn OAuth tokens for the DataSnake company page. Service-role-only RLS; admin UI reads redacted status via linkedin_oauth_status() RPC.';
comment on function public.linkedin_oauth_status() is
  'Phase 9.17.1 — returns connection status without exposing actual token values.';
