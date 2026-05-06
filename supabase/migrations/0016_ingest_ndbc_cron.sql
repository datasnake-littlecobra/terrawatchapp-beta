-- TerraWatch — Phase 9.6: schedule the NDBC buoy ingest worker.
--
-- NDBC publishes observations every 10–60 min depending on station; we pull
-- hourly at minute :18 (after the existing 9 ingesters at :00 through :16).
-- The function URL must be inserted into Vault before the cron fires:
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/ingest-ndbc',
--     'ingest_ndbc_url'
--   );

create or replace function public.trigger_ingest_ndbc()
returns bigint
language sql
security definer
as $$
  select public.trigger_ingest_url('ingest_ndbc_url')
$$;

revoke all on function public.trigger_ingest_ndbc() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-ndbc-hourly';
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-ndbc-hourly',
  '18 * * * *',
  $$select public.trigger_ingest_ndbc();$$
);
