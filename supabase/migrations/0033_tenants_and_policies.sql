-- TerraWatch — Phase 9.14: tenants, tenant_members, policies, RLS.
--
-- An "insurer" tenant uploads their book of policies (CSV → bulk
-- insert) and sees the existing /insurance/portfolio dashboard
-- populated with their own data instead of the demo mock. RLS
-- enforces that each tenant only sees their own policies.
--
-- Tenant onboarding model: any authenticated user can create a tenant
-- via create_tenant() RPC; that user becomes the owner. Owners can
-- add additional members later (RPC also). This is the self-serve
-- model. The admin-issued model (only admins can create tenants) is
-- a 1-line policy change if we later decide to gate it.

-- =====================================================================
-- 1. tenants — one row per insurer / MGA / climate-risk team
-- =====================================================================

create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  contact_email text not null,
  plan          text not null check (plan in ('free','paid')) default 'free',
  policy_limit  int  not null check (policy_limit > 0) default 1000,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users on delete set null
);

create index if not exists tenants_slug_idx on public.tenants (slug);

alter table public.tenants enable row level security;

-- Members see their tenant rows. Admins see all (defense in depth, e.g.
-- for the future admin tenant-management UI).
create policy "members read tenants"
  on public.tenants for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenants.id and tm.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 2. tenant_members — many users per tenant
-- =====================================================================

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null check (role in ('owner','member','viewer')) default 'member',
  added_at  timestamptz not null default now(),
  added_by  uuid references auth.users on delete set null,
  primary key (tenant_id, user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members (user_id);

alter table public.tenant_members enable row level security;

-- A member sees their own member rows + any rows in tenants they belong
-- to (so they can see who their teammates are). Admins see everything.
create policy "members read tenant_members"
  on public.tenant_members for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = tenant_members.tenant_id and tm.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 3. policies — the insurer's book
-- =====================================================================

create table if not exists public.policies (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants on delete cascade,
  policy_id_external  text not null,
  address             text,
  state               text,
  county_fips         text references public.fema_nri (county_fips) on delete set null,
  lat                 double precision,
  lon                 double precision,
  exposure_usd        numeric not null check (exposure_usd >= 0),
  perils              text[] not null default '{}',
  premium_usd         numeric check (premium_usd is null or premium_usd >= 0),
  policy_class        text,
  metadata            jsonb,
  created_at          timestamptz not null default now(),
  unique (tenant_id, policy_id_external)
);

create index if not exists policies_tenant_idx       on public.policies (tenant_id);
create index if not exists policies_county_fips_idx  on public.policies (county_fips) where county_fips is not null;
create index if not exists policies_state_idx        on public.policies (state)       where state is not null;
create index if not exists policies_tenant_exposure_idx on public.policies (tenant_id, exposure_usd desc);

alter table public.policies enable row level security;

create policy "tenant members read policies"
  on public.policies for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = policies.tenant_id and tm.user_id = auth.uid()
    )
  );

-- Writes (insert/update/delete) restricted to owner+member roles. Viewers
-- can read but cannot mutate. The Edge Function (policies-upload) uses
-- service-role and bypasses RLS but checks tenant membership manually.
create policy "tenant owner/member write policies"
  on public.policies for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = policies.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner','member')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = policies.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner','member')
    )
  );

-- =====================================================================
-- 4. Helper RPCs
-- =====================================================================

-- The tenants the current user belongs to. Used by the dashboard
-- top-of-page picker if a user belongs to multiple tenants.
create or replace function public.my_tenants()
returns table (
  id            uuid,
  name          text,
  slug          text,
  plan          text,
  policy_limit  int,
  member_role   text,
  policy_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.policy_limit,
    tm.role as member_role,
    (select count(*)::int from public.policies p where p.tenant_id = t.id) as policy_count
  from public.tenants t
  join public.tenant_members tm on tm.tenant_id = t.id
  where tm.user_id = auth.uid()
  order by t.name;
$$;

grant execute on function public.my_tenants() to authenticated;

-- Create-tenant RPC. Caller becomes the owner of the new tenant.
-- Used during onboarding. Free-tier default; admin can upgrade plan.
create or replace function public.create_tenant(
  p_name          text,
  p_slug          text,
  p_contact_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9-]+$' then
    raise exception 'slug must be lowercase alphanumeric with dashes';
  end if;
  if p_contact_email is null or p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'contact_email required';
  end if;

  insert into public.tenants (name, slug, contact_email, created_by)
  values (p_name, p_slug, p_contact_email, v_uid)
  returning id into v_id;

  insert into public.tenant_members (tenant_id, user_id, role, added_by)
  values (v_id, v_uid, 'owner', v_uid);

  return v_id;
end;
$$;

grant execute on function public.create_tenant(text, text, text) to authenticated;

-- Aggregate tenant analytics — counterparts to the mock-based
-- aggregations in PortfolioView, but per-tenant. Returns a single row.
create or replace function public.tenant_portfolio_summary(p_tenant uuid)
returns table (
  policy_count      int,
  total_exposure    numeric,
  avg_risk_score    numeric,
  top_state         text,
  top_state_exposure numeric,
  county_count      int
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select p.*, f.risk_score
    from public.policies p
    left join public.fema_nri f on f.county_fips = p.county_fips
    where p.tenant_id = p_tenant
      and (
        public.is_admin()
        or exists (
          select 1 from public.tenant_members tm
          where tm.tenant_id = p_tenant and tm.user_id = auth.uid()
        )
      )
  ),
  state_rollup as (
    select state, sum(exposure_usd) as exposure_state
    from mine
    where state is not null
    group by state
    order by exposure_state desc
    limit 1
  )
  select
    (select count(*)::int from mine),
    (select coalesce(sum(exposure_usd), 0) from mine),
    (select round(avg(risk_score)::numeric, 1) from mine where risk_score is not null),
    (select state from state_rollup),
    (select exposure_state from state_rollup),
    (select count(distinct county_fips)::int from mine where county_fips is not null);
$$;

grant execute on function public.tenant_portfolio_summary(uuid) to authenticated;

comment on table public.tenants         is 'Insurance tenants (MGA, specialty insurer, climate-risk team). One row per company.';
comment on table public.tenant_members  is 'Many-to-many: which users belong to which tenants, with a role.';
comment on table public.policies        is 'Per-tenant policy book. RLS gates each row to the tenant members.';
