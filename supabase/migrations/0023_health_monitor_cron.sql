-- TerraWatch — Phase 9.10: schedule the health snapshot.
--
-- Runs every 30 minutes — fast enough that an admin checking the
-- dashboard sees up-to-date status, slow enough that 30 days of
-- history is ~1500 rows per source (manageable).

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'health-monitor-30min';
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
