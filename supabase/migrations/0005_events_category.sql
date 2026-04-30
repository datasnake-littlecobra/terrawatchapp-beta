-- TerraWatch — Phase 9.0: finer-grained event taxonomy.
-- `kind` stays the coarse bucket (seismic/weather/space/tide/ufo/datasnake)
-- so existing code keeps working. `category` is the leaf that drives icons,
-- filter chips, and the UI's category-multiselect. Left intentionally loose
-- (no CHECK constraint) — we'll keep adding leaves as we add sources, and
-- enforcing in DDL would mean a migration every time.

alter table public.events
  add column if not exists category text;

create index if not exists events_category_idx
  on public.events (category)
  where category is not null;

-- Backfill anything we already have: USGS quakes → 'earthquake', SWPC → 'geomagnetic_storm',
-- NWS → 'weather_alert' (the ingest function will refine NWS categories on the
-- next pass; this is just a sane default for rows ingested before this phase).
update public.events
set category = case
  when source = 'usgs.quakes' then 'earthquake'
  when source = 'noaa.swpc.kp' then 'geomagnetic_storm'
  when source = 'nws.alerts' then 'weather_alert'
  else kind
end
where category is null;

-- The events_near RPC has to return `category` too. Postgres doesn't allow
-- changing a function's return shape via CREATE OR REPLACE, so drop + recreate.
drop function if exists public.events_near(
  double precision, double precision, double precision, integer, integer
);

create or replace function public.events_near(
  center_lat double precision,
  center_lon double precision,
  radius_km double precision default 500,
  since_hours integer default 72,
  max_rows integer default 100
) returns table (
  id uuid,
  source text,
  external_id text,
  kind text,
  category text,
  severity text,
  title text,
  summary text,
  lat double precision,
  lon double precision,
  location_label text,
  country text,
  region text,
  magnitude double precision,
  depth_km double precision,
  kp double precision,
  distance_km double precision,
  occurred_at timestamptz,
  expires_at timestamptz,
  payload jsonb
)
language sql
stable
as $$
  select
    e.id,
    e.source,
    e.external_id,
    e.kind,
    e.category,
    e.severity,
    e.title,
    e.summary,
    case when e.location is not null then st_y(e.location::geometry) end as lat,
    case when e.location is not null then st_x(e.location::geometry) end as lon,
    e.location_label,
    e.country,
    e.region,
    e.magnitude,
    e.depth_km,
    e.kp,
    case
      when e.location is not null
      then st_distance(e.location, st_makepoint(center_lon, center_lat)::geography) / 1000.0
      else null
    end as distance_km,
    e.occurred_at,
    e.expires_at,
    e.payload
  from public.events e
  where e.occurred_at >= now() - make_interval(hours => since_hours)
    and (
      e.location is null
      or st_dwithin(
        e.location,
        st_makepoint(center_lon, center_lat)::geography,
        radius_km * 1000
      )
    )
  order by
    case e.severity when 'danger' then 0 when 'caution' then 1 else 2 end,
    e.occurred_at desc
  limit greatest(1, least(max_rows, 500));
$$;

grant execute on function public.events_near(
  double precision, double precision, double precision, integer, integer
) to anon, authenticated;
