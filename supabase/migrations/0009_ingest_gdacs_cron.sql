-- TerraWatch — Phase 9.2.1: schedule the GDACS ingest worker.
--
-- GDACS gives us a single global multi-hazard feed (volcanoes, cyclones,
-- floods, tsunamis, wildfires) — closes the gap that left the Mayon eruption
-- invisible to our pipeline. Scheduled at minute :10 to stay clear of the
-- existing 5 ingesters at :00, :02, :04, :06, :08.
--
-- The function URL must be inserted into Vault before the cron runs:
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/ingest-gdacs',
--     'ingest_gdacs_url'
--   );
--
-- (See DEPLOY.md for the full Vault setup instructions.)

create or replace function public.trigger_ingest_gdacs()
returns bigint
language sql
security definer
as $$
  select public.trigger_ingest_url('ingest_gdacs_url')
$$;

revoke all on function public.trigger_ingest_gdacs() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-gdacs-hourly';
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-gdacs-hourly',
  '10 * * * *',
  $$select public.trigger_ingest_gdacs();$$
);
