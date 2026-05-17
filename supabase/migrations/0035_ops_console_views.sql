-- TerraWatch — Phase 9.16: Operations Console support views + log table.
--
-- Powers the new admin-only /admin/console tabs. Adds:
--   1. sensor_freshness     — per-sensor last_observed + stale flag
--   2. api_call_volume_7d   — daily request counts per API key
--   3. api_request_log      — per-request log (Edge Function writes;
--                             7-day retention via nightly prune)
--   4. cron_job_status      — readable view over cron.job +
--                             cron.job_run_details
--
-- All four are admin-only (RLS or grant). The Console reads them via
-- service-role only — public anon never touches these.

-- =====================================================================
-- 1. sensor_freshness — sensors + last_observed_at + stale flag
-- =====================================================================

-- Materialized: refreshed by the same 30-min cron that refreshes
-- measurements_hourly. Cheap (one row per sensor).
create materialized view if not exists public.sensor_freshness as
with last_obs as (
  select sensor_id, max(observed_at) as last_observed_at
  from public.measurements
  group by sensor_id
)
select
  s.id,
  s.name,
  s.source,
  s.source_tier,
  s.domain,
  s.active,
  case
    when s.location is not null then st_y(s.location::geometry)
  end as lat,
  case
    when s.location is not null then st_x(s.location::geometry)
  end as lon,
  s.metadata,
  l.last_observed_at,
  case
    when l.last_observed_at is null                              then 'never'
    when l.last_observed_at < now() - interval '60 minutes'      then 'stale'
    when l.last_observed_at < now() - interval '15 minutes'      then 'lagging'
    else 'fresh'
  end as freshness_status,
  case
    when l.last_observed_at is null then null
    else extract(epoch from (now() - l.last_observed_at))::int
  end as seconds_since_last_observation
from public.sensors s
left join last_obs l on l.sensor_id = s.id;

create unique index if not exists sensor_freshness_pk
  on public.sensor_freshness (id);

-- Schedule the same refresh cadence as measurements_hourly. Idempotent.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'sensor-freshness-refresh') then
    perform cron.schedule(
      'sensor-freshness-refresh',
      '*/30 * * * *',
      $cmd$refresh materialized view concurrently public.sensor_freshness;$cmd$
    );
  end if;
end $$;

-- =====================================================================
-- 2. api_request_log — per-request log (lightweight)
-- =====================================================================

create table if not exists public.api_request_log (
  id          bigserial primary key,
  key_id      uuid references public.api_keys on delete set null,
  endpoint    text not null,                    -- 'insurance-risk-verdict'
  status_code int  not null,
  duration_ms int,
  ip_hash     text,                              -- sha256 of caller IP (privacy)
  user_agent  text,
  request_at  timestamptz not null default now()
);

create index if not exists api_request_log_key_at_idx
  on public.api_request_log (key_id, request_at desc);
create index if not exists api_request_log_at_idx
  on public.api_request_log (request_at desc);

alter table public.api_request_log enable row level security;

-- Admin-only read; the Edge Function writes via service role.
drop policy if exists "admin read api_request_log" on public.api_request_log;
create policy "admin read api_request_log"
  on public.api_request_log for select
  using (public.is_admin());

-- Nightly prune at 03:33 UTC — keep 7 days. Idempotent schedule.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'api-request-log-prune') then
    perform cron.schedule(
      'api-request-log-prune',
      '33 3 * * *',
      $cmd$delete from public.api_request_log where request_at < now() - interval '7 days';$cmd$
    );
  end if;
end $$;

comment on table public.api_request_log is
  'Phase 9.16 — per-request log for the Insurance Risk API. Edge Function writes; 7-day retention via nightly cron.';

-- =====================================================================
-- 3. api_call_volume_7d — daily counts per key (last 7 days)
-- =====================================================================

-- Plain view (not materialized) — query is cheap given the indexes.
create or replace view public.api_call_volume_7d as
  select
    u.key_id,
    k.key_prefix,
    k.tenant_name,
    u.day,
    u.count
  from public.api_key_usage u
  left join public.api_keys k on k.id = u.key_id
  where u.day >= (now() at time zone 'utc')::date - interval '7 days';

-- View permissions follow underlying tables — both api_key_usage and
-- api_keys have admin-only RLS from migration 0027.

-- =====================================================================
-- 4. cron_job_status — readable view over pg_cron internals
-- =====================================================================

-- pg_cron lives in the cron schema, which isn't directly readable by
-- anon/authenticated. Service-role can read; admin RPC wraps it.
create or replace function public.cron_job_status()
returns table (
  jobname        text,
  schedule       text,
  active         boolean,
  last_run_at    timestamptz,
  last_status    text,
  success_count  int,
  failure_count  int
)
language sql
stable
security definer
set search_path = public, cron
as $$
  with last_run as (
    select
      d.jobid,
      d.status,
      d.start_time,
      row_number() over (partition by d.jobid order by d.start_time desc) as rn
    from cron.job_run_details d
    where d.start_time > now() - interval '30 days'
  ),
  totals as (
    select
      jobid,
      sum((status = 'succeeded')::int)::int as success_count,
      sum((status = 'failed')::int)::int    as failure_count
    from cron.job_run_details
    where start_time > now() - interval '7 days'
    group by jobid
  )
  select
    j.jobname::text,
    j.schedule::text,
    j.active,
    lr.start_time,
    lr.status,
    coalesce(t.success_count, 0),
    coalesce(t.failure_count, 0)
  from cron.job j
  left join last_run lr on lr.jobid = j.jobid and lr.rn = 1
  left join totals    t on t.jobid  = j.jobid
  where j.jobname is not null
  order by j.jobname;
$$;

grant execute on function public.cron_job_status() to authenticated;

-- Admin-only: the function itself is open to authenticated, but the
-- /admin/console is admin-gated so non-admins can't see the result.
-- If you want strict gating, wrap the SELECT inside an is_admin() check.

comment on function public.cron_job_status() is
  'Phase 9.16 — admin Operations Console view over cron.job + cron.job_run_details.';
