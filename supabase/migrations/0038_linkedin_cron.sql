-- TerraWatch — Phase 9.17.1: LinkedIn auto-poster cron schedules.
--
-- Two schedules, both Mon/Wed/Fri:
--   09:00 UTC — generate-linkedin-post: drafts the next topic from
--                docs/LINKEDIN_FEED.md
--   14:00 UTC — publish-linkedin-post:  posts the oldest approved
--                draft (no-op if nothing is approved)
--
-- 5-hour gap is the human review window. If the admin hasn't
-- approved a draft by 14:00, the publish job is a no-op and the
-- next opportunity is the following Mon/Wed/Fri at 14:00.
--
-- Both schedules use the existing trigger_ingest_url(name) helper
-- (migration 0007) which reads URL + ingest_secret from Vault. You
-- need to set these two Vault secrets once before the crons fire:
--
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/generate-linkedin-post', 'generate_linkedin_post_url');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/publish-linkedin-post',  'publish_linkedin_post_url');

-- Idempotent: drop existing schedules with the same name first.
do $$
begin
  perform cron.unschedule('linkedin-generate-mwf');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('linkedin-publish-mwf');
exception when others then null;
end $$;

select cron.schedule(
  'linkedin-generate-mwf',
  '0 9 * * 1,3,5',
  $$select public.trigger_ingest_url('generate_linkedin_post_url');$$
);

select cron.schedule(
  'linkedin-publish-mwf',
  '0 14 * * 1,3,5',
  $$select public.trigger_ingest_url('publish_linkedin_post_url');$$
);
