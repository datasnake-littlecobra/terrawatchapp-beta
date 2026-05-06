-- TerraWatch — Phase 9.6: measurements retention + materialized view refresh.
--
-- Time-series data needs explicit retention (it grows fast) and the hourly
-- materialized view from migration 0014 needs periodic refresh to stay
-- useful. Both are wired here as pg_cron jobs.
--
-- Retention tiers (kept tight for v1; revisit when storage justifies):
--   raw measurements:        7 days   (chart's "live" range)
--   measurements_hourly:    365 days  (chart's "historical" range)
--
-- Sensors are NEVER auto-pruned — losing the join row would orphan
-- residual measurement rows and break the dashboard. Mark sensors inactive
-- (active=false) instead if upstream stops reporting.

-- 1. Retention RPC.
create or replace function public.measurements_prune()
returns table (
  raw_removed bigint,
  hourly_removed bigint
)
language plpgsql
security definer
as $$
declare
  r_raw bigint;
  r_hourly bigint;
begin
  delete from public.measurements
  where observed_at < now() - interval '7 days';
  get diagnostics r_raw = row_count;

  delete from public.measurements_hourly
  where hour < now() - interval '365 days';
  get diagnostics r_hourly = row_count;

  return query select r_raw, r_hourly;
end;
$$;

revoke all on function public.measurements_prune() from public, anon, authenticated;

-- 2. Materialized-view refresh wrapper. CONCURRENTLY requires a unique index
--    (we have measurements_hourly_pk). Falls back to a non-concurrent refresh
--    on first run when the view is empty (CONCURRENTLY can't populate from scratch).
create or replace function public.measurements_hourly_refresh()
returns void
language plpgsql
security definer
as $$
begin
  begin
    refresh materialized view concurrently public.measurements_hourly;
  exception when others then
    refresh materialized view public.measurements_hourly;
  end;
end;
$$;

revoke all on function public.measurements_hourly_refresh() from public, anon, authenticated;

-- 3. Schedule both. Refresh every 30 min so chart queries always see <30min lag;
--    prune nightly at 03:17 UTC (off-peak, won't collide with hourly ingesters).
do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname in (
      'measurements-hourly-refresh',
      'measurements-prune-nightly'
    );
exception when others then
  null;
end $$;

select cron.schedule(
  'measurements-hourly-refresh',
  '*/30 * * * *',
  $$select public.measurements_hourly_refresh();$$
);

select cron.schedule(
  'measurements-prune-nightly',
  '17 3 * * *',
  $$select public.measurements_prune();$$
);
