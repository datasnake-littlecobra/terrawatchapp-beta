-- TerraWatch — Phase 9.6: time-series monitoring data model.
--
-- The events table is the wrong shape for continuous sensor data
-- (high-frequency time series, same sensor reporting every 10–60 min for
-- years). This migration adds a separate sensors + measurements pair plus
-- helper views for charts and hero counters.
--
-- The `source_tier` column on sensors is the architecture hook for the
-- public/proprietary toggle in the UI. NDBC ships as 'public'; DataSnake
-- submarine telemetry plugs into the same tables later as 'proprietary'
-- without any schema change — just inserts.

-- 1. Sensors — one row per monitoring station.
create table if not exists public.sensors (
  id text primary key,                                  -- e.g. 'ndbc:46050'
  source text not null,                                 -- 'ndbc' | 'datasnake' | future
  source_tier text not null
    check (source_tier in ('public','proprietary'))
    default 'public',
  name text not null,                                   -- 'Stonewall Bank, OR'
  domain text not null check (domain in ('ocean','air','land')),
  location geography(point, 4326),
  metadata jsonb,                                       -- depth, station type, owner, etc.
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sensors_domain_tier_idx
  on public.sensors (domain, source_tier) where active;
create index if not exists sensors_location_idx
  on public.sensors using gist (location) where active;

alter table public.sensors enable row level security;
create policy "sensors readable by everyone"
  on public.sensors for select to anon, authenticated using (true);

-- 2. Measurements — one row per (sensor, parameter, timestamp).
--    Composite primary key gives us idempotent upserts and time-series
--    queries that hit a covering index.
create table if not exists public.measurements (
  sensor_id text not null references public.sensors on delete cascade,
  parameter text not null,                              -- 'wave_height_m', 'sst_c', etc.
  value double precision not null,
  unit text not null,                                   -- 'm', '°C', 'm/s', 'hPa'
  observed_at timestamptz not null,
  primary key (sensor_id, parameter, observed_at)
);
create index if not exists measurements_param_observed_idx
  on public.measurements (parameter, observed_at desc);
create index if not exists measurements_sensor_observed_idx
  on public.measurements (sensor_id, observed_at desc);

alter table public.measurements enable row level security;
create policy "measurements readable by everyone"
  on public.measurements for select to anon, authenticated using (true);

-- 3. Hourly aggregate — downsampled view for chart queries over long windows.
--    Materialized so chart loads stay snappy even at 7d / 30d ranges.
create materialized view if not exists public.measurements_hourly as
  select
    sensor_id, parameter, unit,
    date_trunc('hour', observed_at) as hour,
    avg(value)   as avg_value,
    min(value)   as min_value,
    max(value)   as max_value,
    count(*)::int as samples
  from public.measurements
  group by sensor_id, parameter, unit, date_trunc('hour', observed_at);

create unique index if not exists measurements_hourly_pk
  on public.measurements_hourly (sensor_id, parameter, hour);
create index if not exists measurements_hourly_param_hour_idx
  on public.measurements_hourly (parameter, hour desc);

-- 4. Monitoring stats view — drives the hero counters on the dashboard.
--    Cheap to compute at query time given the indices above; no need to
--    materialize.
create or replace view public.monitoring_stats as
  select
    s.domain,
    s.source_tier,
    count(distinct s.id) filter (where s.active)                                              as active_sensors,
    count(m.*) filter (where m.observed_at > now() - interval '24 hours')                     as obs_last_24h,
    count(distinct s.id) filter (where m.observed_at > now() - interval '6 hours')            as fresh_sensors,
    max(m.observed_at)                                                                         as latest_observation
  from public.sensors s
  left join public.measurements m on m.sensor_id = s.id
  group by s.domain, s.source_tier;

grant select on public.monitoring_stats to anon, authenticated;

-- 5. Time-series RPC — returns a single sensor + parameter as a clean array.
--    Auto-switches between raw (≤24h windows) and hourly aggregate (longer
--    windows) so the chart never has to render >2000 points.
create or replace function public.measurements_series(
  sensor text,
  param text,
  hours integer default 168
) returns table (
  observed_at timestamptz,
  value double precision,
  min_value double precision,
  max_value double precision,
  unit text
)
language plpgsql
stable
as $$
declare
  use_hourly boolean := hours > 36;  -- 36h cutoff; raw resolution for shorter
begin
  if use_hourly then
    return query
      select
        h.hour as observed_at,
        h.avg_value as value,
        h.min_value,
        h.max_value,
        h.unit
      from public.measurements_hourly h
      where h.sensor_id = sensor
        and h.parameter = param
        and h.hour >= now() - make_interval(hours => hours)
      order by h.hour asc;
  else
    return query
      select
        m.observed_at,
        m.value,
        m.value as min_value,
        m.value as max_value,
        m.unit
      from public.measurements m
      where m.sensor_id = sensor
        and m.parameter = param
        and m.observed_at >= now() - make_interval(hours => hours)
      order by m.observed_at asc;
  end if;
end;
$$;

grant execute on function public.measurements_series(text, text, integer) to anon, authenticated;

-- 6. Sensors-near RPC — buoy picker uses this when geolocation is available.
create or replace function public.sensors_near(
  center_lat double precision,
  center_lon double precision,
  radius_km double precision default 1000,
  domain_filter text default null,
  source_tier_filter text default null,
  max_rows integer default 100
) returns table (
  id text,
  source text,
  source_tier text,
  name text,
  domain text,
  lat double precision,
  lon double precision,
  metadata jsonb,
  distance_km double precision
)
language sql
stable
as $$
  select
    s.id, s.source, s.source_tier, s.name, s.domain,
    case when s.location is not null then st_y(s.location::geometry) end as lat,
    case when s.location is not null then st_x(s.location::geometry) end as lon,
    s.metadata,
    case
      when s.location is not null
      then st_distance(s.location, st_makepoint(center_lon, center_lat)::geography) / 1000.0
      else null
    end as distance_km
  from public.sensors s
  where s.active
    and (domain_filter is null or s.domain = domain_filter)
    and (source_tier_filter is null or s.source_tier = source_tier_filter)
    and (
      s.location is null
      or st_dwithin(s.location, st_makepoint(center_lon, center_lat)::geography, radius_km * 1000)
    )
  order by
    case when s.location is null then 1 else 0 end,
    case
      when s.location is not null
      then st_distance(s.location, st_makepoint(center_lon, center_lat)::geography)
      else null
    end nulls last
  limit greatest(1, least(max_rows, 500));
$$;

grant execute on function public.sensors_near(
  double precision, double precision, double precision, text, text, integer
) to anon, authenticated;
