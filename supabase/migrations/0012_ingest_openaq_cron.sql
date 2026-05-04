-- TerraWatch — Phase 9.2.4: schedule the OpenAQ air-quality ingest worker.
--
-- OpenAQ aggregates 100+ national air-quality networks worldwide. We only
-- ingest readings that cross the US EPA "Unhealthy" PM2.5 threshold
-- (55 µg/m³) — below that the air is fine and there's nothing to report.
-- Each unhealthy location becomes one event per hour bucket.
--
-- Scheduled at minute :16 to stay clear of the existing 8 ingesters.
--
-- One-time manual setup:
--
--   -- function URL into Vault (always required)
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/ingest-openaq',
--     'ingest_openaq_url'
--   );
--
--   -- optional API key for higher rate limits (set as edge secret, not Vault)
--   --   supabase secrets set OPENAQ_API_KEY=<key>
--   -- without it we get rate-limited around 60 req/min, plenty for hourly use.

create or replace function public.trigger_ingest_openaq()
returns bigint
language sql
security definer
as $$
  select public.trigger_ingest_url('ingest_openaq_url')
$$;

revoke all on function public.trigger_ingest_openaq() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-openaq-hourly';
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-openaq-hourly',
  '16 * * * *',
  $$select public.trigger_ingest_openaq();$$
);
