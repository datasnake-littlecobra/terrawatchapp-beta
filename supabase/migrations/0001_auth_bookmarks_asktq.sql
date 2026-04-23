-- TerraWatch — Phase 7 schema
-- Tables: bookmarks, ask_terra_usage
-- RLS is on for both; users can only see their own rows. The Ask Terra
-- edge function uses the service-role key to increment quota counters
-- (bypasses RLS deliberately) so clients cannot spoof a lower count.

create extension if not exists "pgcrypto";

-- Saved locations ------------------------------------------------------------

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  lat double precision not null,
  lon double precision not null,
  kind text not null check (kind in ('home', 'work', 'trip', 'custom')),
  created_at timestamptz not null default now()
);

create index if not exists bookmarks_user_id_created_at_idx
  on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks_select_own" on public.bookmarks;
create policy "bookmarks_select_own"
  on public.bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "bookmarks_insert_own" on public.bookmarks;
create policy "bookmarks_insert_own"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks_update_own" on public.bookmarks;
create policy "bookmarks_update_own"
  on public.bookmarks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks_delete_own" on public.bookmarks;
create policy "bookmarks_delete_own"
  on public.bookmarks for delete
  using (auth.uid() = user_id);

-- Ask Terra daily quota ------------------------------------------------------

create table if not exists public.ask_terra_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ask_terra_usage enable row level security;

drop policy if exists "ask_terra_usage_select_own" on public.ask_terra_usage;
create policy "ask_terra_usage_select_own"
  on public.ask_terra_usage for select
  using (auth.uid() = user_id);

-- Writes go through the edge function (service-role key), no insert/update
-- policies for end-users on purpose.
