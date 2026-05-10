-- TerraWatch — Phase 9.2.2: schedule the Smithsonian GVP ingest worker.
--
-- Smithsonian's Weekly Volcanic Activity Report catches advisory-level
-- volcanic unrest below GDACS's Orange threshold — the long tail of
-- "this volcano is doing something interesting" that doesn't qualify as a
-- humanitarian alert but matters for tracking. Scheduled at minute :12 to
-- stay clear of the existing 6 ingesters at :00, :02, :04, :06, :08, :10.
--
-- The function URL must be inserted into Vault before the cron runs:
--
--   select vault.create_secret(
--     'https://<ref>.supabase.co/functions/v1/ingest-smithsonian',
--     'ingest_smithsonian_url'
--   );

create or replace function public.trigger_ingest_smithsonian()
returns bigint
language sql
security definer
as $$
  select public.trigger_ingest_url('ingest_smithsonian_url')
$$;

revoke all on function public.trigger_ingest_smithsonian() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-smithsonian-hourly';
exception when others then
  null;
end $$;

select cron.schedule(
  'ingest-smithsonian-hourly',
  '12 * * * *',
  $$select public.trigger_ingest_smithsonian();$$
);
