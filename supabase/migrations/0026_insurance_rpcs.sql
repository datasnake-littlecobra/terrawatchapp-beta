-- TerraWatch — Phase 9.12: Insurance dashboard RPCs.
--
-- Public, anon-readable aggregations over public.fema_nri + public.events.
-- Drives the /insurance dashboard counters, top-N hazard lists, county
-- detail panel, choropleth-layer feed, and active-threat overlay.
--
-- Active-threat overlay matches by state (region or country fields on
-- events) rather than lat/lon — FEMA NRI rows don't carry centroids.
-- "Caution + danger severity in the last 24h" is the operational
-- definition of an active threat.

-- ============================================================
-- 1. Aggregate counters for the hero row
-- ============================================================

create or replace function public.insurance_counters()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'counties_indexed', (
      select count(*)::bigint from public.fema_nri
    ),
    'total_eal_usd', (
      select coalesce(sum(expected_annual_loss_total), 0)
      from public.fema_nri
    ),
    'high_risk_counties', (
      select count(*)::bigint
      from public.fema_nri
      where risk_score >= 80
    ),
    'active_threats_in_high_risk', (
      -- Distinct US states that currently have at least one elevated event
      -- AND host at least one high-risk county. Operationally answers
      -- "how many of my high-risk markets are lit up right now?".
      select count(distinct upper(coalesce(e.region, '')))::bigint
      from public.events e
      where e.severity in ('caution', 'danger')
        and e.occurred_at >= now() - interval '24 hours'
        and exists (
          select 1 from public.fema_nri f
          where f.risk_score >= 80
            and (
              upper(f.state)        = upper(coalesce(e.region, ''))
              or upper(f.state_abbrev) = upper(coalesce(e.region, ''))
            )
        )
    ),
    'top_state_by_eal', (
      select jsonb_build_object('state', state, 'eal_usd', eal)
      from (
        select state,
               sum(expected_annual_loss_total) as eal
        from public.fema_nri
        where state is not null
        group by state
        order by eal desc nulls last
        limit 1
      ) t
    ),
    'generated_at', now()
  );
$$;

grant execute on function public.insurance_counters() to anon, authenticated;

-- ============================================================
-- 2. Top counties by hazard (drives the three hazard top-N lists)
-- ============================================================

-- hazard ∈ 'flood' | 'wildfire' | 'hurricane' | 'tornado' | 'earthquake' | 'total'
create or replace function public.insurance_top_counties_by_hazard(
  hazard   text,
  max_rows integer default 10
)
returns table (
  county_fips text,
  state       text,
  county_name text,
  eal_usd     double precision,
  risk_score  double precision,
  population  bigint
)
language sql
stable
security invoker
as $$
  select
    f.county_fips,
    f.state,
    f.county_name,
    case lower(coalesce(hazard, 'total'))
      when 'flood'      then f.eal_flood
      when 'wildfire'   then f.eal_wildfire
      when 'hurricane'  then f.eal_hurricane
      when 'tornado'    then f.eal_tornado
      when 'earthquake' then f.eal_earthquake
      else f.expected_annual_loss_total
    end as eal_usd,
    f.risk_score,
    f.population
  from public.fema_nri f
  where (
    case lower(coalesce(hazard, 'total'))
      when 'flood'      then f.eal_flood
      when 'wildfire'   then f.eal_wildfire
      when 'hurricane'  then f.eal_hurricane
      when 'tornado'    then f.eal_tornado
      when 'earthquake' then f.eal_earthquake
      else f.expected_annual_loss_total
    end
  ) is not null
  order by eal_usd desc nulls last
  limit greatest(1, least(max_rows, 100));
$$;

grant execute on function public.insurance_top_counties_by_hazard(text, integer)
  to anon, authenticated;

-- ============================================================
-- 3. County detail (full row + active threats in same state)
-- ============================================================

create or replace function public.insurance_county_detail(p_county_fips text)
returns table (
  county_fips                 text,
  state                       text,
  state_abbrev                text,
  county_name                 text,
  population                  bigint,
  area_sq_mi                  double precision,
  risk_score                  double precision,
  risk_rating                 text,
  expected_annual_loss_total  double precision,
  social_vulnerability        double precision,
  community_resilience        double precision,
  eal_flood                   double precision,
  eal_wildfire                double precision,
  eal_hurricane               double precision,
  eal_tornado                 double precision,
  eal_earthquake              double precision,
  eal_other                   jsonb,
  lat                         double precision,
  lon                         double precision,
  active_threats_24h          bigint
)
language sql
stable
security invoker
as $$
  select
    f.county_fips,
    f.state,
    f.state_abbrev,
    f.county_name,
    f.population,
    f.area_sq_mi,
    f.risk_score,
    f.risk_rating,
    f.expected_annual_loss_total,
    f.social_vulnerability,
    f.community_resilience,
    f.eal_flood,
    f.eal_wildfire,
    f.eal_hurricane,
    f.eal_tornado,
    f.eal_earthquake,
    f.eal_other,
    f.lat,
    f.lon,
    coalesce((
      select count(*)::bigint
      from public.events e
      where e.severity in ('caution', 'danger')
        and e.occurred_at >= now() - interval '24 hours'
        and (
          upper(coalesce(e.region, '')) = upper(f.state)
          or upper(coalesce(e.region, '')) = upper(coalesce(f.state_abbrev, ''))
        )
    ), 0) as active_threats_24h
  from public.fema_nri f
  where f.county_fips = p_county_fips
  limit 1;
$$;

grant execute on function public.insurance_county_detail(text)
  to anon, authenticated;

-- ============================================================
-- 4. Choropleth feed (county_fips -> value)
-- ============================================================

-- metric ∈ 'risk_score' | 'eal_total' | 'eal_flood' | 'eal_wildfire' | 'eal_hurricane'
create or replace function public.insurance_choropleth_layer(metric text)
returns table (
  county_fips text,
  value       double precision
)
language sql
stable
security invoker
as $$
  select
    county_fips,
    case lower(coalesce(metric, 'risk_score'))
      when 'eal_total'     then expected_annual_loss_total
      when 'eal_flood'     then eal_flood
      when 'eal_wildfire'  then eal_wildfire
      when 'eal_hurricane' then eal_hurricane
      else risk_score
    end as value
  from public.fema_nri
  where (
    case lower(coalesce(metric, 'risk_score'))
      when 'eal_total'     then expected_annual_loss_total
      when 'eal_flood'     then eal_flood
      when 'eal_wildfire'  then eal_wildfire
      when 'eal_hurricane' then eal_hurricane
      else risk_score
    end
  ) is not null;
$$;

grant execute on function public.insurance_choropleth_layer(text)
  to anon, authenticated;

-- ============================================================
-- 5. Active threats joined to high-risk counties
-- ============================================================

-- Returns recent elevated events whose state matches at least one
-- high-risk county. The county_fips column carries the highest-risk
-- county in that state (operational anchor for the dashboard's
-- "active threat near a high-risk market" framing).
create or replace function public.insurance_active_threats_in_high_risk(
  min_risk double precision default 80,
  max_rows integer default 50
)
returns table (
  event_id           uuid,
  source             text,
  category           text,
  severity           text,
  title              text,
  occurred_at        timestamptz,
  country            text,
  region             text,
  matched_state      text,
  matched_county_fips text,
  matched_risk_score double precision
)
language sql
stable
security invoker
as $$
  with high_risk_states as (
    select distinct on (state)
      state,
      state_abbrev,
      county_fips,
      risk_score
    from public.fema_nri
    where risk_score >= min_risk
    order by state, risk_score desc nulls last
  )
  select
    e.id,
    e.source,
    e.category,
    e.severity,
    e.title,
    e.occurred_at,
    e.country,
    e.region,
    h.state,
    h.county_fips,
    h.risk_score
  from public.events e
  join high_risk_states h
    on  upper(coalesce(e.region, '')) = upper(h.state)
    or upper(coalesce(e.region, '')) = upper(coalesce(h.state_abbrev, ''))
  where e.severity in ('caution', 'danger')
    and e.occurred_at >= now() - interval '24 hours'
  order by
    case e.severity when 'danger' then 0 when 'caution' then 1 else 2 end,
    e.occurred_at desc
  limit greatest(1, least(max_rows, 200));
$$;

grant execute on function public.insurance_active_threats_in_high_risk(double precision, integer)
  to anon, authenticated;

-- ============================================================
-- 6. Aggregated state-level EAL (drives the primary chart on the
--    dashboard since we don't ship a county choropleth in v1).
-- ============================================================

create or replace function public.insurance_state_eal(max_rows integer default 25)
returns table (
  state            text,
  state_abbrev     text,
  county_count     bigint,
  total_eal_usd    double precision,
  avg_risk_score   double precision,
  max_risk_score   double precision,
  high_risk_count  bigint
)
language sql
stable
security invoker
as $$
  select
    state,
    max(state_abbrev) as state_abbrev,
    count(*)::bigint  as county_count,
    sum(expected_annual_loss_total) as total_eal_usd,
    avg(risk_score)   as avg_risk_score,
    max(risk_score)   as max_risk_score,
    count(*) filter (where risk_score >= 80)::bigint as high_risk_count
  from public.fema_nri
  where state is not null
  group by state
  order by total_eal_usd desc nulls last
  limit greatest(1, least(max_rows, 60));
$$;

grant execute on function public.insurance_state_eal(integer)
  to anon, authenticated;
