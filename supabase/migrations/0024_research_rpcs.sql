-- TerraWatch — Phase 9.11: aggregation RPCs for research/investor dashboards.
--
-- These power the /research/atmosphere, /research/ocean, and
-- /research/seismic-hazard surfaces. All RPCs are public (no auth
-- required) — they query already-public events / measurements with
-- aggregations that aren't sensitive.
--
-- Design notes:
--   * Each RPC takes plain scalar arguments and returns a flat row
--     shape — easy to consume from PostgREST without custom typing.
--   * Time windows default to "useful" values (30d for quakes, 7d
--     for AQI) and accept overrides.
--   * Where DataSnake-fleet gap claims need real numbers, we surface
--     coverage stats via the same RPCs so the dashboards can render
--     them honestly.

-- ============================================================
-- Atmosphere
-- ============================================================

-- Top air-quality stations by latest reading. Used by the AQI bar chart
-- and the global station map. Returns the most recent reading per
-- distinct station_id within the lookback window.
create or replace function public.research_aq_top_stations(
  since_days integer default 7,
  max_rows   integer default 50
)
returns table (
  station_id    text,
  station_name  text,
  country       text,
  region        text,
  pm25          double precision,
  observed_at   timestamptz,
  lat           double precision,
  lon           double precision
)
language sql
stable
security invoker
as $$
  select distinct on (e.payload->>'station_id')
    coalesce(e.payload->>'station_id', e.id::text)                 as station_id,
    coalesce(e.payload->>'station_name', e.payload->>'city',
             e.title, 'Unknown station')                            as station_name,
    coalesce(e.country, '')                                         as country,
    coalesce(e.region, '')                                          as region,
    coalesce((e.payload->>'value')::double precision,
             (e.payload->>'pm25')::double precision)                as pm25,
    e.occurred_at                                                   as observed_at,
    case when e.location is not null then st_y(e.location::geometry)::double precision end,
    case when e.location is not null then st_x(e.location::geometry)::double precision end
  from public.events e
  where e.source = 'openaq.pm25'
    and e.occurred_at >= now() - (greatest(1, since_days) || ' days')::interval
  order by e.payload->>'station_id', e.occurred_at desc
  limit greatest(1, least(max_rows, 200));
$$;

grant execute on function public.research_aq_top_stations(integer, integer) to anon, authenticated;

-- Heat-comfort grid placeholder: rolls up active heat / heat-advisory
-- events by US region. Real heat-index calculation needs paired
-- temperature + humidity readings, which we don't capture today —
-- this is the gap callout's anchor.
create or replace function public.research_heat_advisories_active()
returns table (
  state_or_region text,
  count           bigint,
  most_severe     text,
  latest          timestamptz
)
language sql
stable
security invoker
as $$
  select
    coalesce(region, country, 'Unknown')          as state_or_region,
    count(*)::bigint                               as count,
    -- Severity ordering: danger > caution > safe
    (array_agg(severity order by
       case severity when 'danger' then 0
                     when 'caution' then 1
                     else 2 end))[1]               as most_severe,
    max(occurred_at)                               as latest
  from public.events
  where category = 'heat'
    and occurred_at >= now() - interval '7 days'
  group by 1
  order by count desc
  limit 25;
$$;

grant execute on function public.research_heat_advisories_active() to anon, authenticated;

-- Wildfire centroids active right now (EONET). Used by the smoke-vs-AQ map.
create or replace function public.research_active_wildfires(max_rows integer default 100)
returns table (
  id           uuid,
  title        text,
  country      text,
  severity     text,
  occurred_at  timestamptz,
  lat          double precision,
  lon          double precision
)
language sql
stable
security invoker
as $$
  select
    e.id,
    e.title,
    coalesce(e.country, ''),
    e.severity,
    e.occurred_at,
    case when e.location is not null then st_y(e.location::geometry)::double precision end,
    case when e.location is not null then st_x(e.location::geometry)::double precision end
  from public.events e
  where e.category = 'wildfire'
    and e.occurred_at >= now() - interval '14 days'
  order by e.occurred_at desc
  limit greatest(1, least(max_rows, 500));
$$;

grant execute on function public.research_active_wildfires(integer) to anon, authenticated;

-- ============================================================
-- Ocean
-- ============================================================

-- Latest sea-surface temperature reading per buoy. Drives the SST
-- distribution histogram + global coverage map.
create or replace function public.research_buoy_sst_latest(since_hours integer default 24)
returns table (
  sensor_id    text,
  sensor_name  text,
  lat          double precision,
  lon          double precision,
  sst_c        double precision,
  observed_at  timestamptz
)
language sql
stable
security invoker
as $$
  select distinct on (m.sensor_id)
    m.sensor_id,
    s.name,
    case when s.location is not null then st_y(s.location::geometry)::double precision end,
    case when s.location is not null then st_x(s.location::geometry)::double precision end,
    m.value,
    m.observed_at
  from public.measurements m
  join public.sensors s on s.id = m.sensor_id
  where m.parameter = 'sst_c'
    and m.observed_at >= now() - (greatest(1, since_hours) || ' hours')::interval
  order by m.sensor_id, m.observed_at desc;
$$;

grant execute on function public.research_buoy_sst_latest(integer) to anon, authenticated;

-- Wave-height distribution today — counts of buoys in each 0.5m bucket.
create or replace function public.research_wave_height_distribution(since_hours integer default 24)
returns table (
  bucket_m  double precision,
  cnt       bigint
)
language sql
stable
security invoker
as $$
  with latest as (
    select distinct on (sensor_id) sensor_id, value
    from public.measurements
    where parameter = 'wave_height_m'
      and observed_at >= now() - (greatest(1, since_hours) || ' hours')::interval
    order by sensor_id, observed_at desc
  )
  select
    floor(value / 0.5) * 0.5 as bucket_m,
    count(*)::bigint
  from latest
  group by 1
  order by 1;
$$;

grant execute on function public.research_wave_height_distribution(integer) to anon, authenticated;

-- ============================================================
-- Seismic
-- ============================================================

-- Magnitude–frequency distribution (Gutenberg–Richter). Returns count
-- per magnitude bin so the frontend can plot log10(N) vs magnitude.
create or replace function public.research_quake_mag_freq(
  since_days integer default 90,
  bin_size   double precision default 0.5
)
returns table (
  mag_bin double precision,
  cnt     bigint
)
language sql
stable
security invoker
as $$
  select
    floor(((e.payload->>'mag')::double precision) / bin_size) * bin_size as mag_bin,
    count(*)::bigint
  from public.events e
  where e.source = 'usgs.quakes'
    and e.occurred_at >= now() - (greatest(1, since_days) || ' days')::interval
    and (e.payload->>'mag') is not null
    and (e.payload->>'mag')::double precision >= 2.5
  group by 1
  order by 1;
$$;

grant execute on function public.research_quake_mag_freq(integer, double precision) to anon, authenticated;

-- Top regions by quake count (last N days). Used by the seismic
-- dashboard's "most-active regions" panel.
create or replace function public.research_quake_top_regions(
  since_days integer default 30,
  max_rows   integer default 10
)
returns table (
  region   text,
  cnt      bigint,
  max_mag  double precision
)
language sql
stable
security invoker
as $$
  select
    coalesce(nullif(region, ''), nullif(country, ''), 'Unknown') as region,
    count(*)::bigint,
    max((payload->>'mag')::double precision) as max_mag
  from public.events
  where source = 'usgs.quakes'
    and occurred_at >= now() - (greatest(1, since_days) || ' days')::interval
  group by 1
  order by 2 desc
  limit greatest(1, least(max_rows, 50));
$$;

grant execute on function public.research_quake_top_regions(integer, integer) to anon, authenticated;

-- Volcano alert timeline — distinct active-volcano events over time.
-- Smithsonian + USGS HANS combined.
create or replace function public.research_volcano_timeline(
  since_days integer default 90
)
returns table (
  occurred_at  timestamptz,
  volcano_name text,
  country      text,
  severity     text,
  source       text
)
language sql
stable
security invoker
as $$
  select
    e.occurred_at,
    coalesce(e.payload->>'volcano_name',
             e.payload->>'name',
             e.title,
             'Unknown')                          as volcano_name,
    coalesce(e.country, '')                       as country,
    e.severity,
    e.source
  from public.events e
  where e.category = 'volcano'
    and e.occurred_at >= now() - (greatest(1, since_days) || ' days')::interval
  order by e.occurred_at desc
  limit 200;
$$;

grant execute on function public.research_volcano_timeline(integer) to anon, authenticated;

-- ============================================================
-- Hero counters (one RPC, everyone reads from it)
-- ============================================================

create or replace function public.research_counters()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    -- Atmosphere
    'aq_stations_24h', (
      select count(distinct payload->>'station_id')::bigint
      from public.events
      where source = 'openaq.pm25'
        and occurred_at >= now() - interval '24 hours'
    ),
    'aq_countries_7d', (
      select count(distinct nullif(country, ''))::bigint
      from public.events
      where source = 'openaq.pm25'
        and occurred_at >= now() - interval '7 days'
    ),
    'aq_max_pm25_24h', (
      select coalesce(max((payload->>'value')::double precision), 0)
      from public.events
      where source = 'openaq.pm25'
        and occurred_at >= now() - interval '24 hours'
    ),
    'wildfires_active_14d', (
      select count(*)::bigint
      from public.events
      where category = 'wildfire'
        and occurred_at >= now() - interval '14 days'
    ),
    'heat_advisories_7d', (
      select count(*)::bigint
      from public.events
      where category = 'heat'
        and occurred_at >= now() - interval '7 days'
    ),
    -- Ocean
    'buoys_reporting_24h', (
      select count(distinct sensor_id)::bigint
      from public.measurements
      where observed_at >= now() - interval '24 hours'
    ),
    'measurements_24h', (
      select count(*)::bigint
      from public.measurements
      where observed_at >= now() - interval '24 hours'
    ),
    -- Seismic
    'quakes_m5_30d', (
      select count(*)::bigint
      from public.events
      where source = 'usgs.quakes'
        and (payload->>'mag')::double precision >= 5
        and occurred_at >= now() - interval '30 days'
    ),
    'days_since_m7', (
      select coalesce(extract(epoch from (now() - max(occurred_at))) / 86400.0, 9999)::double precision
      from public.events
      where source = 'usgs.quakes'
        and (payload->>'mag')::double precision >= 7
    ),
    'volcanoes_active_30d', (
      select count(distinct coalesce(payload->>'volcano_name', payload->>'name', title))::bigint
      from public.events
      where category = 'volcano'
        and occurred_at >= now() - interval '30 days'
    ),
    -- Generated-at marker so clients can show staleness.
    'generated_at', now()
  );
$$;

grant execute on function public.research_counters() to anon, authenticated;
