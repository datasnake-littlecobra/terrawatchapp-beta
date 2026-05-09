-- TerraWatch — Phase 9.12: FEMA National Risk Index, county-level.
--
-- Underwriting-grade climate-risk data: Expected Annual Loss ($) by hazard,
-- composite Risk Score (0-100), Social Vulnerability Index, Community
-- Resilience Index, all keyed to 5-digit county FIPS. ~3,200 rows.
--
-- Public-readable; writes only via service-role from the seed-fema-nri
-- edge function. Refreshed yearly when FEMA publishes a new release
-- (typically Q4) — re-running the seed is idempotent on county_fips.
--
-- Hazards spotlighted (per-column EAL): flood (coastal + riverine),
-- wildfire, hurricane, tornado, earthquake. The remaining 13 hazards
-- live in eal_other (jsonb) so the schema doesn't sprawl.

create table if not exists public.fema_nri (
  county_fips                 text primary key,           -- 5-digit FIPS, e.g. '06037'
  state                       text not null,
  state_abbrev                text,
  county_name                 text not null,
  population                  bigint,
  building_value_usd          double precision,           -- EAL_VALB-aligned base
  area_sq_mi                  double precision,
  -- Composite scores (FEMA NRI native fields)
  risk_score                  double precision,           -- 0-100
  risk_rating                 text,                       -- 'Very Low' .. 'Very High'
  expected_annual_loss_total  double precision,           -- $ across all 18 hazards
  social_vulnerability        double precision,
  community_resilience        double precision,
  -- Spotlight hazards EAL ($)
  eal_flood                   double precision,           -- coastal-flood + riverine-flood
  eal_wildfire                double precision,
  eal_hurricane               double precision,
  eal_tornado                 double precision,
  eal_earthquake              double precision,
  -- Catch-all for the remaining 13 hazards. Keys match FEMA's 4-letter
  -- hazard codes: AVLN, CWAV, DRGT, HAIL, HWAV, ISTM, LNDS, LTNG, SWND,
  -- TSUN, VLCN, WNTW.
  eal_other                   jsonb,
  -- Centroid (optional; not all seed sources provide one)
  lat                         double precision,
  lon                         double precision,
  updated_at                  timestamptz not null default now()
);

create index if not exists fema_nri_state_idx
  on public.fema_nri (state);
create index if not exists fema_nri_state_abbrev_idx
  on public.fema_nri (state_abbrev);
create index if not exists fema_nri_risk_score_idx
  on public.fema_nri (risk_score desc nulls last);
create index if not exists fema_nri_eal_total_idx
  on public.fema_nri (expected_annual_loss_total desc nulls last);
create index if not exists fema_nri_eal_flood_idx
  on public.fema_nri (eal_flood desc nulls last)
  where eal_flood is not null;
create index if not exists fema_nri_eal_wildfire_idx
  on public.fema_nri (eal_wildfire desc nulls last)
  where eal_wildfire is not null;
create index if not exists fema_nri_eal_hurricane_idx
  on public.fema_nri (eal_hurricane desc nulls last)
  where eal_hurricane is not null;

alter table public.fema_nri enable row level security;

drop policy if exists "public reads fema nri" on public.fema_nri;
create policy "public reads fema nri" on public.fema_nri
  for select using (true);
-- writes only via service-role (the seed-fema-nri edge function); no
-- INSERT/UPDATE/DELETE policy here means anon + authenticated cannot write.
