-- TerraWatch — cleanup: drop orphaned legacy tables.
--
-- Pre-unified-events-table schema experiments, superseded by the `events`
-- table (migration 0002) and never referenced again. Confirmed via
-- repo-wide grep: zero references in src/ or supabase/functions/. All six
-- have 0 rows and RLS disabled (a live security gap on their own, since
-- they were still exposed to anon/authenticated via PostgREST).

drop table if exists public.weather_observations;
drop table if exists public.seismic_events;
drop table if exists public.flood_zones;
drop table if exists public.seismic_stations;
drop table if exists public.risk_scores_cache;
drop table if exists public.parametric_sensor_readings;
