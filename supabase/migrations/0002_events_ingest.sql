-- TerraWatch — Phase 8: global events ingest
-- One unified `events` table that all feeds (USGS seismic, NWS weather alerts,
-- NOAA SWPC Kp, future UFO datasets, future DataSnake proprietary sources)
-- upsert into on a schedule. The client reads from this table instead of
-- hitting upstream APIs directly, which (a) makes the feed instant on cold
-- load, (b) lets us layer Ask Terra analytics on top of a stable shape, and
-- (c) gives us one swap point when DataSnake sources come online.
--
-- Writes happen only via the `ingest-events` edge function using the
-- service-role key. RLS allows anonymous select so the feed stays readable
-- without forcing sign-in.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- Events ---------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  kind text not null check (kind in ('seismic', 'weather', 'space', 'tide', 'ufo', 'datasnake')),
  severity text not null check (severity in ('safe', 'caution', 'danger')),
  title text not null,
  summary text not null default '',
  location geography(point, 4326),
  location_label text,
  country text,
  region text,
  magnitude double precision,
  depth_km double precision,
  kp double precision,
  occurred_at timestamptz not null,
  expires_at timestamptz,
  ingested_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (source, external_id)
);

create index if not exists events_occurred_at_idx
  on public.events (occurred_at desc);

create index if not exists events_kind_severity_occurred_at_idx
  on public.events (kind, severity, occurred_at desc);

create index if not exists events_location_gix
  on public.events using gist (location);

create index if not exists events_expires_at_idx
  on public.events (expires_at)
  where expires_at is not null;

alter table public.events enable row level security;

-- Public feed: anyone (including unauthenticated clients) can read events.
drop policy if exists "events_select_public" on public.events;
create policy "events_select_public"
  on public.events for select
  using (true);

-- No user-level insert/update/delete policies — the edge function writes with
-- the service-role key and bypasses RLS deliberately. Clients cannot forge
-- events.

-- Nearby-events RPC ----------------------------------------------------------
-- Returns events within `radius_km` of (`center_lat`, `center_lon`), sorted by
-- severity then recency. Avoids shipping PostGIS functions to the client.

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

-- Pruning --------------------------------------------------------------------
-- Keep the table small. Seismic and Kp rows age out after 30 days; weather
-- alerts use their own expires_at. The edge function calls this at the end
-- of each ingest pass so we don't need pg_cron for it.

create or replace function public.events_prune(older_than_days integer default 30)
returns integer
language plpgsql
security definer
as $$
declare
  removed integer;
begin
  delete from public.events
  where (expires_at is not null and expires_at < now())
     or occurred_at < now() - make_interval(days => older_than_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
