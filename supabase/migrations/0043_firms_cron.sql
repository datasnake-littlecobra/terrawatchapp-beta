-- TerraWatch — Phase 9.18.2: NASA FIRMS ingest hourly cron.
--
-- Schedules the ingest-firms Edge Function using the same
-- trigger_ingest_url(secret_name) helper as all Phase 9.0.1 ingesters.
--
-- Once-per-environment Vault setup (run in Supabase SQL Editor):
--
--   select vault.create_secret(
--     'https://<your-ref>.supabase.co/functions/v1/ingest-firms',
--     'ingest_firms_url'
--   );
--
-- The 'ingest_secret' Vault entry is already set from Phase 9.0.1.
--
-- Schedule: minute :38 every hour. Staggered from other ingesters
-- (NDBC :18, NOAA NWS :22, NWS alerts :02, etc.) to avoid pile-up
-- at the top of the hour.
--
-- Note: the function exits early with { skipped: true } if the
-- FIRMS_MAP_KEY secret is not yet configured. No error logged.

do $$
begin
  perform cron.unschedule('ingest-firms-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-firms-hourly',
  '38 * * * *',
  $$select public.trigger_ingest_url('ingest_firms_url');$$
);
