-- TerraWatch — Phase 9.10: schedule the health snapshot.
--
-- Runs every 30 minutes — fast enough that an admin checking the
-- dashboard sees up-to-date status, slow enough that 30 days of
-- history is ~1500 rows per source (manageable).
--
-- Self-healing patch: this migration redefines compute_health_snapshot
-- with a JOIN through cron.job rather than referencing
-- cron.job_run_details.jobname directly. Older pg_cron versions don't
-- expose `jobname` on the run-details table — only `jobid` — and the
-- original 0022 query failed at runtime on those versions. We
-- CREATE OR REPLACE here so the function is corrected even when 0022
-- was already recorded as applied.
--
-- cron.unschedule() is called with a literal string instead of the
-- `from cron.job where jobname = ...` correlated form, which had its
-- own pg_cron-version-dependent parsing issues.

-- ---------------------------------------------------------------------
-- Self-healing redefinition of compute_health_snapshot.
-- Identical to 0022 except for the cron.job_run_details lookup, which
-- now joins via cron.job to obtain jobname portably.
-- ---------------------------------------------------------------------
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
    -- Latest cron run for this job. Join through cron.job because some
    -- pg_cron versions don't expose `jobname` on cron.job_run_details
    -- — only `jobid`. The cron.job table always has both.
    select d.status, d.start_time
      into last_status, last_run
      from cron.job_run_details d
      join cron.job j on j.jobid = d.jobid
     where j.jobname = pair.job
     order by d.start_time desc
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

-- ---------------------------------------------------------------------
-- Schedule the cron, idempotently.
-- ---------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('health-monitor-30min');
exception when others then
  null;
end $$;

select cron.schedule(
  'health-monitor-30min',
  '*/30 * * * *',
  $$select public.compute_health_snapshot();$$
);

-- Run once now so the dashboard isn't empty on first load. Idempotent
-- if the cron has already fired.
select public.compute_health_snapshot();
