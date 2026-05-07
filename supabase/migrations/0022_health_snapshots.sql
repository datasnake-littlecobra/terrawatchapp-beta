-- TerraWatch — Phase 9.10: ingest health monitoring.
--
-- Hourly-snapshotted view of every ingester's status, queryable from
-- the admin health dashboard. The compute function reads from
-- cron.job_run_details (which pg_cron writes synchronously) and from
-- public.events to derive a per-source status: healthy / degraded /
-- failing. Snapshots accumulate into health_snapshots so the dashboard
-- can render trends over the last 7-30 days.
--
-- Design notes:
--   * Compute runs as security definer with explicit search_path so
--     the cron schema is reachable without granting cron access to
--     the role that owns this function.
--   * Snapshot rows are admin-readable (RLS via is_admin()), public-
--     invisible — operational data, not a public surface.
--   * Pruning is built in (keeps last 30 days). No separate cron job
--     needed for retention.

create table if not exists public.health_snapshots (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  source      text not null,                              -- e.g. 'usgs.quakes', 'nws.alerts'; or 'overall'
  status      text not null check (status in ('healthy','degraded','failing','unknown')),
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists health_snapshots_source_taken_idx
  on public.health_snapshots (source, taken_at desc);

alter table public.health_snapshots enable row level security;

create policy "admin reads health snapshots"
  on public.health_snapshots
  for select
  using (public.is_admin());

-- Source <-> cron-job mapping. Single source of truth for both the
-- compute function and any future "which sources should we monitor"
-- diagnostics. Add new ingesters here as they ship.
create or replace function public.health_source_jobs()
returns table (source text, job text)
language sql immutable as $$
  values
    ('usgs.quakes',      'ingest-seismic-hourly'),
    ('nws.alerts',       'ingest-weather-hourly'),
    ('noaa.swpc.kp',     'ingest-space-hourly'),
    ('nasa.eonet',       'ingest-wildfires-hourly'),
    ('usgs.volcanoes',   'ingest-volcanoes-hourly'),
    ('gdacs.alerts',     'ingest-gdacs-hourly'),
    ('smithsonian.gvp',  'ingest-smithsonian-hourly'),
    ('noaa.nhc',         'ingest-nhc-hourly'),
    ('openaq.pm25',      'ingest-openaq-hourly'),
    ('ndbc',             'ingest-ndbc-hourly');
$$;

-- Compute one snapshot row per source. Classification rules:
--   * No cron run in the last 4h        -> 'failing' (probably misconfigured)
--   * Most recent cron run failed       -> 'degraded'
--   * Cron green AND no rows in 24h     -> 'degraded' (cron OK, source quiet/broken)
--   * Cron green AND rows present       -> 'healthy'
--
-- The "rows in 24h" check catches silent upstream failures (HTTP 200
-- with empty body, malformed payload) that don't surface as cron
-- failures. NDBC writes to measurements not events, so it's classified
-- against measurements instead.
create or replace function public.compute_health_snapshot()
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  pair record;
  last_status text;
  last_run timestamptz;
  rows_24h bigint;
  classified text;
begin
  for pair in select * from public.health_source_jobs() loop
    -- Latest cron run for this job
    select status, start_time
      into last_status, last_run
      from cron.job_run_details
     where jobname = pair.job
     order by start_time desc
     limit 1;

    -- Volume in last 24h. NDBC measurements live in a different table.
    if pair.source = 'ndbc' then
      select count(*) into rows_24h
        from public.measurements
       where observed_at >= now() - interval '24 hours';
    else
      select count(*) into rows_24h
        from public.events
       where source = pair.source
         and occurred_at >= now() - interval '24 hours';
    end if;

    if last_run is null or last_run < now() - interval '4 hours' then
      classified := 'failing';
    elsif last_status = 'failed' then
      classified := 'degraded';
    elsif coalesce(rows_24h, 0) = 0 then
      classified := 'degraded';
    else
      classified := 'healthy';
    end if;

    insert into public.health_snapshots (source, status, details)
    values (
      pair.source,
      classified,
      jsonb_build_object(
        'last_cron_status', last_status,
        'last_cron_run',    last_run,
        'rows_24h',         rows_24h,
        'job',              pair.job
      )
    );
  end loop;

  -- Prune snapshots older than 30 days. Cheap because the index covers it.
  delete from public.health_snapshots where taken_at < now() - interval '30 days';
end;
$$;

revoke all on function public.compute_health_snapshot() from public, anon, authenticated;

-- Admin-readable summary RPC. Returns latest status per source plus
-- 24h / 7d row counts. Drives the admin health dashboard's table view.
create or replace function public.health_summary()
returns table (
  source           text,
  latest_status    text,
  latest_taken_at  timestamptz,
  rows_24h         bigint,
  rows_7d          bigint,
  last_event_at    timestamptz,
  details          jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  with snapshots as (
    select distinct on (s.source)
      s.source, s.status, s.taken_at, s.details
    from public.health_snapshots s
    order by s.source, s.taken_at desc
  ),
  events_stats as (
    select
      source,
      count(*) filter (where occurred_at >= now() - interval '24 hours')::bigint as r24,
      count(*) filter (where occurred_at >= now() - interval '7 days')::bigint   as r7d,
      max(occurred_at) as last_at
    from public.events
    group by source
  ),
  ndbc_stats as (
    select 'ndbc'::text as source,
           count(*) filter (where observed_at >= now() - interval '24 hours')::bigint as r24,
           count(*) filter (where observed_at >= now() - interval '7 days')::bigint   as r7d,
           max(observed_at) as last_at
    from public.measurements
  )
  select
    snap.source,
    snap.status,
    snap.taken_at,
    coalesce(combined.r24, 0)::bigint,
    coalesce(combined.r7d, 0)::bigint,
    combined.last_at,
    snap.details
  from snapshots snap
  left join (
    select * from events_stats
    union all
    select * from ndbc_stats
  ) combined on combined.source = snap.source
  order by
    case snap.status when 'failing' then 0 when 'degraded' then 1 else 2 end,
    snap.source;
end;
$$;

grant execute on function public.health_summary() to authenticated;

-- Trend RPC for sparklines: returns one row per (source, hour-bucket) in
-- the last 7 days with status counts. Frontend folds this into colored
-- dots/bars so admins can see when a source went degraded.
create or replace function public.health_trend(since_hours integer default 168)
returns table (
  source     text,
  bucket     timestamptz,
  status     text,
  cnt        bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  select
    s.source,
    date_trunc('hour', s.taken_at) as bucket,
    s.status,
    count(*)::bigint as cnt
  from public.health_snapshots s
  where s.taken_at >= now() - (greatest(1, since_hours) || ' hours')::interval
  group by s.source, date_trunc('hour', s.taken_at), s.status
  order by s.source, bucket;
end;
$$;

grant execute on function public.health_trend(integer) to authenticated;
