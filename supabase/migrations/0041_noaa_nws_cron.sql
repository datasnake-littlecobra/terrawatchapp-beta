-- TerraWatch — Phase 9.18.1: NOAA NWS observations hourly cron.
--
-- Schedules the ingest-noaa-nws-obs Edge Function on the same
-- shared pattern as the other Phase 9.0.1 ingesters:
--   trigger_ingest_url(secret_name) — reads URL from Vault, POSTs
--   with x-ingest-secret header.
--
-- Once-per-environment Vault setup (run in Supabase SQL Editor):
--
--   select vault.create_secret(
--     'https://<your-ref>.supabase.co/functions/v1/ingest-noaa-nws-obs',
--     'ingest_noaa_nws_obs_url'
--   );
--
-- The 'ingest_secret' Vault entry is already set from Phase 9.0.1.
--
-- Schedule: minute :22 every hour. Staggered from the other
-- hourly ingesters (NDBC :18, FEMA seed manual, NWS alerts :02,
-- etc.) so we don't pile up at the top of the hour.

do $$
begin
  perform cron.unschedule('ingest-noaa-nws-obs-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-noaa-nws-obs-hourly',
  '22 * * * *',
  $$select public.trigger_ingest_url('ingest_noaa_nws_obs_url');$$
);
