-- TerraWatch — Phase 8.2 follow-up: slow the ingest cadence.
-- The feeds don't change fast enough to warrant every-10-min hits. Hourly is
-- more than fresh enough for USGS quakes / NWS alerts / Kp and keeps upstream
-- etiquette friendly. Once everything is stable we can stretch this to every
-- few hours or daily — just drop another migration with a different schedule
-- string.

-- Replace the old schedule in place. `cron.schedule` will upsert by jobname.
do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname in ('ingest-events-every-10-min', 'ingest-events-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-events-hourly',
  '0 * * * *',
  $$select public.trigger_ingest_events();$$
);
