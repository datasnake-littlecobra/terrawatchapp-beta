-- TerraWatch — Phase 9.1.1: events_recent RPC for the global feed.
--
-- The /events page wants a global view (no center point), but selecting
-- directly from public.events fails because the table stores location as
-- geography(point), not lat/lon columns. This RPC returns the same row
-- shape as events_near (minus distance_km) with PostGIS extracting lat/lon.
-- Optional category and severity filters push selectivity to the DB so the
-- 500-row cap stays meaningful even when the table grows.

create or replace function public.events_recent(
  since_hours integer default 168,
  max_rows integer default 500,
  category_filter text default null,
  severity_filter text default null
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
    e.occurred_at,
    e.expires_at,
    e.payload
  from public.events e
  where e.occurred_at >= now() - make_interval(hours => since_hours)
    and (category_filter is null or e.category = category_filter)
    and (severity_filter is null or e.severity = severity_filter)
  order by
    case e.severity when 'danger' then 0 when 'caution' then 1 else 2 end,
    e.occurred_at desc
  limit greatest(1, least(max_rows, 500));
$$;

grant execute on function public.events_recent(integer, integer, text, text)
  to anon, authenticated;
