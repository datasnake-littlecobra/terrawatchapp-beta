-- TerraWatch — Phase 9.9: per-admin daily quota for the AI blog generator.
--
-- Mirrors the ask_terra_usage table shape from 0001 so the edge function
-- can lift the same quota-check pattern. Default budget is 5 generations
-- per admin per UTC day (overridable via GENERATE_BLOG_DAILY_LIMIT env in
-- the edge function). Each generation produces all four platform variants
-- in one Anthropic call, so the 5/day cap is meaningful even though it
-- looks small next to the trip-verdict's matching limit.

create table if not exists public.blog_generator_usage (
  user_id     uuid not null references auth.users on delete cascade,
  day         date not null,
  count       integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.blog_generator_usage enable row level security;

-- Read scope: admins can see their own usage row (drives the "N left
-- today" footer in the generator UI). Writes happen via service-role
-- inside the edge function, no client-side write policy needed.
create policy "admin reads own blog generator usage"
  on public.blog_generator_usage
  for select
  using (auth.uid() = user_id and public.is_admin());
