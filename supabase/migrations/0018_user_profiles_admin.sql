-- TerraWatch — Phase 9.8: user profiles + admin role + admin signup flow.
--
-- Adds an in-app role system distinct from Supabase's `auth.users` (which
-- is intentionally minimal). `user_profiles.role` is the per-user app-level
-- claim; `is_admin()` is the single source of truth that RLS policies and
-- edge functions check. New users get role='user' automatically via a
-- trigger on auth.users insert.
--
-- Admin signup flow:
--   1. User visits /admin/sign-up, enters email + password + a shared admin
--      signup code.
--   2. Frontend signs them up via the standard Supabase password flow.
--   3. After signup completes, frontend calls `redeem_admin_code(code)`
--      RPC. The code is compared against `vault.decrypted_secrets` row
--      named `admin_signup_code` (set once from the Supabase SQL editor —
--      see DEPLOY.md). Match → role flips to 'admin'.
--   4. After redeem, the new admin can log in via the regular /auth/sign-in
--      OR /admin/sign-in surface — same credentials, same Supabase user.
--
-- Why a shared code stored in Vault instead of per-invite tokens:
-- consistent with the cron-secret pattern from migration 0003, simple to
-- rotate (update the Vault row), no extra DB table, no dashboard
-- workflow to mint tokens. Trade-off: one compromised code lets an
-- attacker promote any signup; rotate by updating the Vault row if it
-- leaks. For the small founder-only admin pool TerraWatch needs, this is
-- right-sized.

-- 1. user_profiles -----------------------------------------------------------

create table if not exists public.user_profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  role         text not null check (role in ('user','admin')) default 'user',
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Users can see their own profile (and only their own). The `is_admin()`
-- helper below also reads this table — security definer bypasses RLS, so
-- the helper still works for both roles.
create policy "read own profile"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

-- Self-update is allowed for non-role columns. Role is admin-only via the
-- redeem RPC; we deliberately don't add an UPDATE policy that would let a
-- user PATCH their own role to 'admin' from the client.
create policy "update own non-role fields"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and role = (select role from public.user_profiles where user_id = auth.uid()));

-- 2. is_admin() helper ------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 3. Auto-create profile on signup ------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. redeem_admin_code(code) RPC --------------------------------------------
--
-- Called from the client after a successful signup on /admin/sign-up. The
-- code is checked against `app.admin_signup_code` (a Postgres runtime
-- setting). The setting is written by the deploy pipeline from the
-- ADMIN_SIGNUP_CODE secret — see DEPLOY.md.
--
-- Returns true on success, false on mismatch or missing setting. Never
-- raises (so timing-attacks can't distinguish error states).

create or replace function public.redeem_admin_code(submitted_code text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  uid uuid := auth.uid();
  expected text;
begin
  if uid is null then
    return false;
  end if;

  select decrypted_secret into expected
    from vault.decrypted_secrets
    where name = 'admin_signup_code'
    limit 1;

  if expected is null or expected = '' then
    return false;
  end if;
  if submitted_code is null or submitted_code = '' then
    return false;
  end if;
  if submitted_code <> expected then
    return false;
  end if;

  update public.user_profiles
     set role = 'admin', updated_at = now()
   where user_id = uid;

  -- If the profile row didn't exist for some reason (e.g. trigger raced),
  -- create it directly as admin.
  if not found then
    insert into public.user_profiles (user_id, role)
    values (uid, 'admin')
    on conflict (user_id) do update set role = 'admin', updated_at = now();
  end if;

  return true;
end;
$$;

grant execute on function public.redeem_admin_code(text) to authenticated;

-- 5. Backfill profiles for any users who already exist before this migration.
insert into public.user_profiles (user_id, role)
select u.id, 'user'
from auth.users u
left join public.user_profiles p on p.user_id = u.id
where p.user_id is null;
