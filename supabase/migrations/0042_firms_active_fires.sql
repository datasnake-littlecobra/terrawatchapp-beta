-- TerraWatch — Phase 9.18.2: NASA FIRMS active fire detections table.
--
-- Stores VIIRS SNPP + NOAA-21 NRT fire detections ingested hourly
-- by the ingest-firms Edge Function. Rolling 7-day window (older rows
-- deleted on each ingest run).
--
-- Columns match the FIRMS CSV export format (latitude, longitude,
-- bright_ti4, frp, confidence, satellite) with a computed geography
-- column for spatial queries.
--
-- RPC firms_detections_recent(p_days int) returns all detections
-- from the last p_days days, ordered by frp desc. Used by the
-- /weather-intelligence/map page.

create table if not exists public.firms_active_fires (
  id           bigint generated always as identity primary key,
  lat          double precision not null,
  lon          double precision not null,
  location     geography(point, 4326),
  brightness   numeric,          -- VIIRS I-4 channel brightness temperature (K)
  frp          numeric,          -- Fire Radiative Power (MW)
  confidence   text check (confidence in ('low', 'nominal', 'high')),
  satellite    text,             -- 'NOAA-21' | 'Suomi NPP' | 'Aqua' | 'Terra'
  acq_datetime timestamptz not null,
  ingested_at  timestamptz not null default now(),
  unique (lat, lon, acq_datetime)
);

create index if not exists firms_location_idx
  on public.firms_active_fires using gist (location);

create index if not exists firms_acq_idx
  on public.firms_active_fires (acq_datetime desc);

alter table public.firms_active_fires enable row level security;

create policy "firms anon select"
  on public.firms_active_fires for select to anon, authenticated
  using (true);

-- =====================================================================
-- firms_detections_recent — recent detections for the map
-- =====================================================================

create or replace function public.firms_detections_recent(
  p_days int default 3
)
returns table (
  id           bigint,
  lat          double precision,
  lon          double precision,
  brightness   numeric,
  frp          numeric,
  confidence   text,
  satellite    text,
  acq_datetime timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, lat, lon, brightness, frp, confidence, satellite, acq_datetime
  from public.firms_active_fires
  where acq_datetime >= now() - (p_days || ' days')::interval
  order by frp desc nulls last
  limit 2000;
$$;

grant execute on function public.firms_detections_recent(int) to anon, authenticated;

comment on table public.firms_active_fires is
  'Phase 9.18.2: NASA FIRMS VIIRS NRT active fire detections. Ingested hourly by ingest-firms Edge Function. Rolling 7-day window.';
comment on function public.firms_detections_recent(int) is
  'Phase 9.18.2: returns fire detections from the last p_days days (default 3), ordered by FRP descending, limit 2000. Called by /weather-intelligence/map.';
