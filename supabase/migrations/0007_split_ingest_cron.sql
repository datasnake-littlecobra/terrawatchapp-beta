-- TerraWatch — Phase 9.0.1: split ingest into per-source edge functions.
-- The single `ingest-events` worker kept hitting WORKER_RESOURCE_LIMIT
-- (per-invocation memory cap, ~256 MB) even after sequential pipelining,
-- chunked upserts, smaller upstream feeds, and a 500-row cap. Splitting into
-- five per-source functions gives each its own full memory/CPU budget and
-- isolates failure modes (NWS down ≠ wildfires down).
--
-- Each function exposes the same shared-secret + pg_net contract as the old
-- monolith. URLs live in Vault (one row per function) — see DEPLOY.md.

-- 1. Tear down the old monolith schedule + helper.
do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname in ('ingest-events-every-10-min', 'ingest-events-hourly');
exception when others then
  null;
end $$;

drop function if exists public.trigger_ingest_events();

-- 2. Generic helper that pulls (url_secret, ingest_secret) from Vault and
--    POSTs an empty JSON body to the function. Returns the pg_net request id.
create or replace function public.trigger_ingest_url(url_secret_name text)
returns bigint
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  req_id bigint;
  fn_url text;
  ingest_secret text;
begin
  select decrypted_secret into fn_url
    from vault.decrypted_secrets
    where name = url_secret_name
    limit 1;

  select decrypted_secret into ingest_secret
    from vault.decrypted_secrets
    where name = 'ingest_secret'
    limit 1;

  if fn_url is null or ingest_secret is null then
    raise notice 'trigger_ingest_url(%): missing vault secrets', url_secret_name;
    return null;
  end if;

  select net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-ingest-secret', ingest_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into req_id;

  return req_id;
end;
$$;

revoke all on function public.trigger_ingest_url(text) from public, anon, authenticated;

-- 3. Thin per-source wrappers so cron.schedule statements stay readable.
create or replace function public.trigger_ingest_seismic()   returns bigint language sql security definer as $$ select public.trigger_ingest_url('ingest_seismic_url')   $$;
create or replace function public.trigger_ingest_weather()   returns bigint language sql security definer as $$ select public.trigger_ingest_url('ingest_weather_url')   $$;
create or replace function public.trigger_ingest_space()     returns bigint language sql security definer as $$ select public.trigger_ingest_url('ingest_space_url')     $$;
create or replace function public.trigger_ingest_wildfires() returns bigint language sql security definer as $$ select public.trigger_ingest_url('ingest_wildfires_url') $$;
create or replace function public.trigger_ingest_volcanoes() returns bigint language sql security definer as $$ select public.trigger_ingest_url('ingest_volcanoes_url') $$;

revoke all on function public.trigger_ingest_seismic()   from public, anon, authenticated;
revoke all on function public.trigger_ingest_weather()   from public, anon, authenticated;
revoke all on function public.trigger_ingest_space()     from public, anon, authenticated;
revoke all on function public.trigger_ingest_wildfires() from public, anon, authenticated;
revoke all on function public.trigger_ingest_volcanoes() from public, anon, authenticated;

-- 4. Schedule the 5 jobs at staggered minutes so DB load stays even.
--    Idempotent: drop any prior schedule of the same name first.
do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname in (
      'ingest-seismic-hourly',
      'ingest-weather-hourly',
      'ingest-space-hourly',
      'ingest-wildfires-hourly',
      'ingest-volcanoes-hourly'
    );
exception when others then
  null;
end $$;

select cron.schedule('ingest-seismic-hourly',   '0 * * * *', $$select public.trigger_ingest_seismic();$$);
select cron.schedule('ingest-weather-hourly',   '2 * * * *', $$select public.trigger_ingest_weather();$$);
select cron.schedule('ingest-space-hourly',     '4 * * * *', $$select public.trigger_ingest_space();$$);
select cron.schedule('ingest-wildfires-hourly', '6 * * * *', $$select public.trigger_ingest_wildfires();$$);
select cron.schedule('ingest-volcanoes-hourly', '8 * * * *', $$select public.trigger_ingest_volcanoes();$$);
