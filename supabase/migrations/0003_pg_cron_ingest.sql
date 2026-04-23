-- TerraWatch — Phase 8.2: schedule the ingest function from pg_cron.
-- GitHub Actions' `*/10 * * * *` cron trigger is unreliable: delayed
-- activation after first push, throttled during load, and doesn't run at all
-- from non-default branches. pg_cron runs inside Postgres and is tied only to
-- the DB's uptime, which is dramatically more reliable for a feed that backs
-- user-visible data.
--
-- The edge function URL and ingest secret live in Supabase Vault (set once
-- from the SQL editor — see DEPLOY.md). Using Vault keeps secrets out of
-- migration source and lets operators rotate without a new migration.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper that pulls the URL + secret from Vault and POSTs to the edge
-- function. Returns the pg_net request id so you can trace an async call
-- back to `net.http_response` if you need to debug.
create or replace function public.trigger_ingest_events()
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
    where name = 'ingest_events_url'
    limit 1;

  select decrypted_secret into ingest_secret
    from vault.decrypted_secrets
    where name = 'ingest_secret'
    limit 1;

  if fn_url is null or ingest_secret is null then
    raise notice 'trigger_ingest_events: missing vault secrets (ingest_events_url, ingest_secret)';
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

revoke all on function public.trigger_ingest_events() from public, anon, authenticated;

-- Idempotent schedule setup: drop any prior schedule of the same name, then
-- recreate. Safe to re-run the migration.
do $$
begin
  perform cron.unschedule(jobname)
    from cron.job
    where jobname = 'ingest-events-every-10-min';
exception when others then
  -- cron.job may not exist yet on first install; ignore.
  null;
end $$;

select cron.schedule(
  'ingest-events-every-10-min',
  '*/10 * * * *',
  $$select public.trigger_ingest_events();$$
);
