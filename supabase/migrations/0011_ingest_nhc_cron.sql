-- TerraWatch — Phase 9.2.3a: schedule the NOAA NHC hurricane ingest worker.
--
-- NHC's CurrentStorms.json is the authoritative active-storm feed for the
-- Atlantic and East Pacific basins. Off-season is a normal "0 active storms"
-- state for ~6 months per year. Scheduled at minute :14 to stay clear of the
-- existing 7 ingesters.
--
-- The function URL must be inserted into Vault before the cron runs:
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/ingest-nhc',
--     'ingest_nhc_url'
--   );
--
-- Phase 9.2.3b will add JTWC for W.Pac / Indian Ocean / S.Pac coverage —
-- those use legacy text bulletins and need their own parser. Until then,
-- GDACS catches major typhoons in those basins at Orange+ severity.

create or replace function public.trigger_ingest_nhc()
returns bigint
language sql
security definer
as $$
  select public.trigger_ingest_url('ingest_nhc_url')
$$;

revoke all on function public.trigger_ingest_nhc() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-nhc-hourly';
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-nhc-hourly',
  '14 * * * *',
  $$select public.trigger_ingest_nhc();$$
);
