-- TerraWatch — fix the broken measurements_prune() and pause the
-- DataSnake proprietary sensor demo tick (Insurance is not current
-- priority).
--
-- Root cause (confirmed via cron.job_run_details): measurements_prune()
-- has been failing every night since it was created. It tried to
-- `delete from public.measurements_hourly ...` -- but that's a
-- materialized view, which cannot be deleted from row-by-row in
-- Postgres. Because both deletes ran in one function with no exception
-- handling, that error rolled back the ENTIRE transaction, undoing the
-- valid raw-measurements delete that ran immediately before it. Net
-- effect: raw `measurements` was never actually pruned and grew to
-- 1.89M rows / 470MB (71% of total database size).
--
-- Fix: drop the invalid materialized-view statement entirely -- a real
-- 365-day historical rollup independent of raw retention would need
-- measurements_hourly to be a real table with its own retention, not a
-- materialized view; that's a separate, bigger change, not attempted
-- here. This migration only makes the 7-day raw retention actually work.

drop function if exists public.measurements_prune();

create function public.measurements_prune()
returns table (raw_removed bigint)
language plpgsql
security definer
as $$
declare
  r_raw bigint;
begin
  delete from public.measurements
  where observed_at < now() - interval '7 days';
  get diagnostics r_raw = row_count;

  return query select r_raw;
end;
$$;

revoke all on function public.measurements_prune() from public, anon, authenticated;

-- One-time catch-up: the nightly job has been failing silently for
-- months, so run the retention cutoff directly now instead of waiting
-- for tonight's cron fire to pick up the fixed function.
select public.measurements_prune();

-- Drop the synthetic AI Models inference log -- zero citations, zero
-- remaining reader since the /ai-models frontend was removed. Keep
-- model_registry: it holds real dataset/paper citations for 8 future
-- ML verticals, not synthetic output.
drop table if exists public.model_inference_log;

-- Pause the DataSnake proprietary sensor demo tick. Function, table,
-- and the 20 seeded sensor rows all stay intact -- this only
-- unschedules the cron job. Resume later with:
--   select cron.schedule('ds-proprietary-tick', '*/10 * * * *',
--     $$select public.ds_proprietary_tick();$$);
-- The fixed prune job above will then actually keep it bounded to a
-- rolling ~7 days instead of growing unbounded again.
select cron.unschedule('ds-proprietary-tick');
